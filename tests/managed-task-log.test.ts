// 任务日志端到端测试：被管理会话观察写入，调度会话 pre-step 增量注入、全新会话快照、去重与顺序。
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { readArchiveNotices } from '../src/lark-super-agent/archive-notices.ts';
import { runGit } from '../src/lark-super-agent/git.ts';
import { apply } from '../src/lark-super-agent/index.ts';
import {
  insertionIndex,
  TASK_LOG_SOURCE_KIND,
} from '../src/lark-super-agent/managed/task-log-injector.ts';
import { isoTime } from '../src/lark-super-agent/notes.ts';
import type { SuperAgentService } from '../src/lark-super-agent/service.ts';
import { appendTaskLogEntry, readTaskLog } from '../src/lark-super-agent/task-log.ts';
import type { Context } from '../src/types.ts';
import { makeCtx } from './helpers.ts';

type RowCtx = ReturnType<typeof makeCtx>;

interface Decision {
  kind: string;
  messages: Array<{ source: { kind: string; reminder?: true }; content: { text: string }[] }>;
}

let home: string;
let root: string;

// CI 运行器没有全局 git 身份；建任务的 git 提交需要显式身份，与其余台账测试一致。
beforeAll(async () => {
  await runGit(['--version']);
  process.env.GIT_CONFIG_COUNT = '2';
  process.env.GIT_CONFIG_KEY_0 = 'user.name';
  process.env.GIT_CONFIG_VALUE_0 = 'Lark Super Agent Test';
  process.env.GIT_CONFIG_KEY_1 = 'user.email';
  process.env.GIT_CONFIG_VALUE_1 = 'lark-super-agent@example.invalid';
});

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'task-log-home-'));
  root = mkdtempSync(join(tmpdir(), 'task-log-root-'));
  process.env['DSH_HOME'] = home;
  mkdirSync(join(home, 'lark-bridge'), { recursive: true });
  writeFileSync(
    join(home, 'lark-bridge', 'state.json'),
    JSON.stringify({ workspaceRoot: root, sessionId: 'dispatch' }),
    'utf8',
  );
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(root, { recursive: true, force: true });
  delete process.env['DSH_HOME'];
});

function startRow(services: Record<string, unknown> = {}) {
  const base = makeCtx({ services });
  const provided: Array<[string, unknown]> = [];
  const ctx = Object.assign(base, {
    provide(name: string, value: unknown) {
      provided.push([name, value]);
      return () => undefined;
    },
    inject(deps: string[], callback: (scoped: unknown) => void) {
      if (deps.every((dep) => base.get(dep) !== undefined)) callback(ctx);
      return () => true;
    },
  });
  apply(ctx as unknown as Context);
  return { base: base as RowCtx, service: provided[0]?.[1] as SuperAgentService };
}

async function seedTask(service: SuperAgentService, sessionId: string): Promise<string> {
  const { taskId } = await service.createTask({
    title: `任务 ${sessionId}`,
    sessionId,
    workspaceId: 'workspace-a',
    cwd: '/project',
    message: { text: 'start' },
  });
  return taskId;
}

function userEvent(seq: number, text: string, kind = 'user') {
  return {
    type: 'user/message',
    seq,
    data: { id: `m${seq}`, role: 'user', source: { kind }, content: [{ type: 'text', text }] },
  };
}

function stopEvent(seq: number, reason: unknown) {
  return { type: 'turn/end', seq, data: { turn: 1, reason } };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 80));

/** 调度会话的事件日志模拟。 */
function dispatchSession() {
  const events: unknown[] = [];
  return {
    events,
    session: {
      id: 'dispatch',
      get seq() {
        return events.length;
      },
      eventAt: (seq: number) => events[seq],
    },
  };
}

async function runPreStep(base: RowCtx, payload: unknown, decision: Decision): Promise<Decision> {
  const listeners = base._onCallbacks.get('agent/pre-step') ?? [];
  let next: () => Promise<Decision> = async () => decision;
  for (const listener of [...listeners].reverse()) {
    const after = next;
    next = async () => (await listener(payload, after)) as Decision;
  }
  return next();
}

const textOf = (message: Decision['messages'][number]) =>
  message.content.map((block) => block.text).join('');

const larkMessage = (text = '你好') => ({
  id: 'lark-1',
  role: 'user',
  source: { kind: 'lark-bridge' },
  content: [{ type: 'text', text }],
});

const reminderMessage = () => ({
  id: 'reminder-1',
  role: 'user',
  source: { kind: 'lark-bridge', reminder: true },
  content: [{ type: 'text', text: '<system-reminder>r</system-reminder>' }],
});

describe('任务日志写入', () => {
  it('被管理会话收到用户直接消息时写一条日志，调度会话不被唤醒', async () => {
    const { base, service } = startRow();
    const taskId = await seedTask(service, 'worker');
    base._emit('session/event', { id: 'worker' }, userEvent(7, '直接回答你的问题'));
    await flush();
    const entries = await readTaskLog(root, taskId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'worker:7',
      type: 'user_message',
      text: '直接回答你的问题',
    });
  });

  it('重复观察同一事件不重复写入', async () => {
    const { base, service } = startRow();
    const taskId = await seedTask(service, 'worker');
    base._emit('session/event', { id: 'worker' }, userEvent(7, 'a'));
    base._emit('session/event', { id: 'worker' }, userEvent(7, 'a'));
    await flush();
    expect(await readTaskLog(root, taskId)).toHaveLength(1);
  });

  it('其他来源、未被管理会话与空消息不写日志', async () => {
    const { base, service } = startRow();
    const taskId = await seedTask(service, 'worker');
    base._emit('session/event', { id: 'worker' }, userEvent(1, 'x', 'dsh-plugin-meta-tools'));
    base._emit('session/event', { id: 'worker' }, userEvent(2, 'x', 'lark-super-agent'));
    base._emit('session/event', { id: 'worker' }, userEvent(3, '   '));
    base._emit('session/event', { id: 'stranger' }, userEvent(4, 'x'));
    await flush();
    expect(await readTaskLog(root, taskId)).toEqual([]);
  });

  it('用户主动停止轮次时写停止条目', async () => {
    const { base, service } = startRow();
    const taskId = await seedTask(service, 'worker');
    base._emit(
      'session/event',
      { id: 'worker' },
      stopEvent(9, { kind: 'aborted', reason: { kind: 'user' } }),
    );
    await flush();
    expect((await readTaskLog(root, taskId))[0]).toMatchObject({
      id: 'worker:9',
      type: 'user_stop',
      text: '',
    });
  });

  it('归档引发的取消、其他取消原因与正常结束都不写日志', async () => {
    const { base, service } = startRow({ workspaceRegistry: { archivedSessionIds: ['worker'] } });
    const taskId = await seedTask(service, 'worker');
    base._emit(
      'session/event',
      { id: 'worker' },
      stopEvent(1, { kind: 'aborted', reason: { kind: 'user' } }),
    );
    await flush();
    expect(await readTaskLog(root, taskId)).toEqual([]);

    const other = startRow();
    const otherTask = await seedTask(other.service, 'worker-2');
    other.base._emit(
      'session/event',
      { id: 'worker-2' },
      stopEvent(2, { kind: 'aborted', reason: { kind: 'disposed' } }),
    );
    other.base._emit('session/event', { id: 'worker-2' }, stopEvent(3, { kind: 'completed' }));
    await flush();
    expect(await readTaskLog(root, otherTask)).toEqual([]);
  });
});

describe('任务日志注入', () => {
  it('全新会话先收到未结束任务快照；注入后同一条目不再注入，压缩不影响', async () => {
    const { base, service } = startRow();
    const taskId = await seedTask(service, 'worker');
    await appendTaskLogEntry(root, taskId, {
      sessionId: 'worker',
      seq: 1,
      type: 'user_message',
      text: '直接回答',
    });
    const { events, session } = dispatchSession();
    const payload = { agent: { session }, step: 1 };

    const first = await runPreStep(base, payload, { kind: 'enter', messages: [larkMessage()] });
    const injected = first.messages.find((m) => m.source.kind === TASK_LOG_SOURCE_KIND);
    expect(injected).toBeDefined();
    const text = textOf(injected as Decision['messages'][number]);
    expect(text).toContain('<task_snapshot covers_entries="worker:1">');
    expect(text).toContain(`<task id="${taskId}" title="任务 worker" status="in_progress"`);
    expect(text).toContain('<task_log_entry id="worker:1"');
    expect(text).toContain('直接回答');
    expect(first.messages.map((m) => m.source.kind)).toEqual([TASK_LOG_SOURCE_KIND, 'lark-bridge']);

    events.push({ type: 'user/message', seq: 0, data: injected });
    const second = await runPreStep(base, payload, { kind: 'enter', messages: [larkMessage()] });
    expect(second.messages.map((m) => m.source.kind)).toEqual(['lark-bridge']);

    await appendTaskLogEntry(root, taskId, {
      sessionId: 'worker',
      seq: 2,
      type: 'user_stop',
      text: '',
    });
    const third = await runPreStep(base, payload, { kind: 'enter', messages: [larkMessage()] });
    const added = third.messages.find((m) => m.source.kind === TASK_LOG_SOURCE_KIND);
    expect(textOf(added as Decision['messages'][number])).toContain(
      '<task_log_entry id="worker:2"',
    );
    expect(textOf(added as Decision['messages'][number])).not.toContain('worker:1"');
    expect(textOf(added as Decision['messages'][number])).not.toContain('task_snapshot');
  });

  it('快照只附最新报告之后的条目，更早的条目记为已覆盖而不会随后补注入', async () => {
    const { base, service } = startRow();
    const taskId = await seedTask(service, 'worker');
    const early = new Date(2026, 0, 1, 8, 0, 0);
    const reportAt = new Date(2026, 0, 1, 9, 0, 0);
    const late = new Date(2026, 0, 1, 10, 0, 0);
    await appendTaskLogEntry(root, taskId, {
      sessionId: 'worker',
      seq: 1,
      type: 'user_message',
      text: '报告之前',
      now: () => early,
    });
    await appendTaskLogEntry(root, taskId, {
      sessionId: 'worker',
      seq: 2,
      type: 'user_message',
      text: '报告之后',
      now: () => late,
    });
    const reportId = 'report-20260101090000-abc123';
    await mkdir(join(root, 'reports', taskId), { recursive: true });
    await writeFile(
      join(root, 'reports', taskId, `${reportId}.md`),
      `---\nreportId: "${reportId}"\ntime: ${JSON.stringify(isoTime(reportAt))}\n---\n\nbody\n`,
      'utf8',
    );
    const ledgerPath = join(root, 'message-task-status.json');
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as {
      tasks: Array<{ reportIds: string[] }>;
    };
    ledger.tasks[0]?.reportIds.push(reportId);
    writeFileSync(ledgerPath, JSON.stringify(ledger), 'utf8');

    const { events, session } = dispatchSession();
    const payload = { agent: { session }, step: 1 };
    const first = await runPreStep(base, payload, { kind: 'enter', messages: [larkMessage()] });
    const injected = first.messages.find((m) => m.source.kind === TASK_LOG_SOURCE_KIND);
    const text = textOf(injected as Decision['messages'][number]);
    expect(text).toContain('worker:1,worker:2');
    expect(text).toContain(`latest_report="reports/${taskId}/${reportId}.md"`);
    expect(text).toContain('报告之后');
    expect(text).not.toContain('报告之前');

    events.push({ type: 'user/message', seq: 0, data: injected });
    const second = await runPreStep(base, payload, { kind: 'enter', messages: [larkMessage()] });
    expect(second.messages.map((m) => m.source.kind)).toEqual(['lark-bridge']);
  });

  it('没有未结束任务时也注入空快照，使全新会话标记落地', async () => {
    const { base } = startRow();
    const { events, session } = dispatchSession();
    const payload = { agent: { session }, step: 1 };
    const first = await runPreStep(base, payload, { kind: 'enter', messages: [larkMessage()] });
    const injected = first.messages.find((m) => m.source.kind === TASK_LOG_SOURCE_KIND);
    expect(textOf(injected as Decision['messages'][number])).toContain(
      '<task_snapshot covers_entries="">',
    );
    events.push({ type: 'user/message', seq: 0, data: injected });
    const second = await runPreStep(base, payload, { kind: 'enter', messages: [larkMessage()] });
    expect(second.messages.map((m) => m.source.kind)).toEqual(['lark-bridge']);
  });

  it('缓存丢失后从完整事件日志重建，不重复注入', async () => {
    const { base, service } = startRow();
    const taskId = await seedTask(service, 'worker');
    await appendTaskLogEntry(root, taskId, {
      sessionId: 'worker',
      seq: 1,
      type: 'user_message',
      text: 'a',
    });
    const { events, session } = dispatchSession();
    const payload = { agent: { session }, step: 1 };
    const first = await runPreStep(base, payload, { kind: 'enter', messages: [larkMessage()] });
    events.push({
      type: 'user/message',
      seq: 0,
      data: first.messages.find((m) => m.source.kind === TASK_LOG_SOURCE_KIND),
    });
    // 模拟插件重载：新的行实例没有任何缓存，但会话事件日志仍在。
    const restarted = startRow();
    const again = await runPreStep(restarted.base, payload, {
      kind: 'enter',
      messages: [larkMessage()],
    });
    expect(again.messages.map((m) => m.source.kind)).toEqual(['lark-bridge']);
  });

  it('注入消息排在桥接提醒之后、第一条飞书消息之前，且与提醒的补注顺序无关', () => {
    const batch = [reminderMessage(), larkMessage()] as never[];
    expect(insertionIndex(batch)).toBe(1);
    expect(insertionIndex([larkMessage()] as never[])).toBe(0);
    expect(insertionIndex([reminderMessage()] as never[])).toBe(1);
    expect(insertionIndex([] as never[])).toBe(0);
  });

  it('非调度会话、第一步没有消息与读取失败时不注入', async () => {
    const { base, service } = startRow();
    await seedTask(service, 'worker');
    const { session } = dispatchSession();
    const worker = await runPreStep(
      base,
      { agent: { session: { ...session, id: 'worker' } }, step: 1 },
      { kind: 'enter', messages: [larkMessage()] },
    );
    expect(worker.messages.map((m) => m.source.kind)).toEqual(['lark-bridge']);
    const empty = await runPreStep(
      base,
      { agent: { session }, step: 1 },
      { kind: 'enter', messages: [] },
    );
    expect(empty.messages).toEqual([]);

    writeFileSync(
      join(home, 'lark-bridge', 'state.json'),
      JSON.stringify({ workspaceRoot: null, sessionId: 'dispatch' }),
      'utf8',
    );
    const unavailable = await runPreStep(
      base,
      { agent: { session }, step: 1 },
      { kind: 'enter', messages: [larkMessage()] },
    );
    expect(unavailable.messages.map((m) => m.source.kind)).toEqual(['lark-bridge']);
  });

  it('全新会话快照列出全部未读报告并要求先读', async () => {
    const { base, service } = startRow();
    const taskId = await seedTask(service, 'worker');
    const ledgerPath = join(root, 'message-task-status.json');
    const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as {
      tasks: Array<{ reportIds: string[]; deliveredReportIds?: string[] }>;
    };
    ledger.tasks[0]?.reportIds.push('report-20260101090000-abc123', 'report-20260101100000-def456');
    if (ledger.tasks[0] !== undefined) ledger.tasks[0].deliveredReportIds = [];
    writeFileSync(ledgerPath, JSON.stringify(ledger), 'utf8');

    const { session } = dispatchSession();
    const first = await runPreStep(
      base,
      { agent: { session }, step: 1 },
      { kind: 'enter', messages: [larkMessage()] },
    );
    const injected = first.messages.find((m) => m.source.kind === TASK_LOG_SOURCE_KIND);
    const text = textOf(injected as Decision['messages'][number]);
    expect(text).toContain('<unread_reports>');
    expect(text).toContain(
      `<unread_report taskid="${taskId}" reportid="report-20260101090000-abc123">reports/${taskId}/report-20260101090000-abc123.md</unread_report>`,
    );
    expect(text).toContain(
      `<unread_report taskid="${taskId}" reportid="report-20260101100000-def456">reports/${taskId}/report-20260101100000-def456.md</unread_report>`,
    );
    expect(text).toContain('before you reply');
  });
});

describe('归档通知注入', () => {
  it('归档通知并入任务日志消息、排在日志条目之后，重复 pre-step 与压缩后不再出现', async () => {
    const { base, service } = startRow({ workspaceRegistry: { archivedSessionIds: ['worker'] } });
    const taskId = await seedTask(service, 'worker');
    const keeper = await seedTask(service, 'keeper');
    await appendTaskLogEntry(root, keeper, {
      sessionId: 'keeper',
      seq: 1,
      type: 'user_message',
      text: '直接回答',
    });
    await service.notifyArchived('worker');

    const { events, session } = dispatchSession();
    const payload = { agent: { session }, step: 1 };
    const first = await runPreStep(base, payload, { kind: 'enter', messages: [larkMessage()] });
    const injected = first.messages.find((m) => m.source.kind === TASK_LOG_SOURCE_KIND);
    expect(injected).toBeDefined();
    const text = textOf(injected as Decision['messages'][number]);
    expect(text).toContain('<task_log_entry id="keeper:1"');
    expect(text.indexOf('<task_log_entry')).toBeLessThan(text.indexOf('<task_session_archived'));
    expect(text).toContain(`sessionid="worker" taskid="${taskId}"`);
    expect(text).toMatch(/<task_session_archived id="[^"]+"/);
    expect(await readArchiveNotices(root)).toHaveLength(1);

    events.push({ type: 'user/message', seq: 0, data: injected });
    const second = await runPreStep(base, payload, { kind: 'enter', messages: [larkMessage()] });
    expect(second.messages.map((m) => m.source.kind)).toEqual(['lark-bridge']);
    expect(await readArchiveNotices(root)).toEqual([]);

    // 压缩只改模型可见表层，事件日志仍在，因此不再注入。
    const compressed = await runPreStep(base, payload, {
      kind: 'enter',
      messages: [larkMessage('压缩摘要')],
    });
    expect(compressed.messages.map((m) => m.source.kind)).toEqual(['lark-bridge']);
  });

  it('注入请求失败未写入事件日志时，下一次 pre-step 继续注入', async () => {
    const { base, service } = startRow();
    await seedTask(service, 'worker');
    await service.notifyArchived('worker');

    const { events, session } = dispatchSession();
    const payload = { agent: { session }, step: 1 };
    const first = await runPreStep(base, payload, { kind: 'enter', messages: [larkMessage()] });
    const firstNotice = first.messages.find((m) => m.source.kind === TASK_LOG_SOURCE_KIND);
    expect(textOf(firstNotice as Decision['messages'][number])).toContain('<task_session_archived');

    const second = await runPreStep(base, payload, { kind: 'enter', messages: [larkMessage()] });
    const secondNotice = second.messages.find((m) => m.source.kind === TASK_LOG_SOURCE_KIND);
    expect(textOf(secondNotice as Decision['messages'][number])).toContain(
      '<task_session_archived',
    );
    expect(await readArchiveNotices(root)).toHaveLength(1);
  });

  it('插件重启后未注入的通知仍然出现，已注入的不重复', async () => {
    const pending = startRow();
    const pendingTask = await seedTask(pending.service, 'worker-a');
    await pending.service.notifyArchived('worker-a');
    const pendingSession = dispatchSession();
    const pendingPayload = { agent: { session: pendingSession.session }, step: 1 };
    await runPreStep(pending.base, pendingPayload, { kind: 'enter', messages: [larkMessage()] });

    const restartedPending = startRow();
    const pendingAgain = await runPreStep(restartedPending.base, pendingPayload, {
      kind: 'enter',
      messages: [larkMessage()],
    });
    const repeated = pendingAgain.messages.find((m) => m.source.kind === TASK_LOG_SOURCE_KIND);
    expect(textOf(repeated as Decision['messages'][number])).toContain(
      '<task_session_archived id="',
    );
    expect(textOf(repeated as Decision['messages'][number])).toContain(`taskid="${pendingTask}"`);

    const injected = pendingAgain.messages.find((m) => m.source.kind === TASK_LOG_SOURCE_KIND);
    pendingSession.events.push({ type: 'user/message', seq: 0, data: injected });
    const restartedAfter = startRow();
    const after = await runPreStep(restartedAfter.base, pendingPayload, {
      kind: 'enter',
      messages: [larkMessage()],
    });
    expect(after.messages.map((m) => m.source.kind)).toEqual(['lark-bridge']);
    expect(await readArchiveNotices(root)).toEqual([]);
  });

  it('恢复归档会话时删除待注入记录', async () => {
    const { base, service } = startRow({
      workspaceRegistry: {
        archivedSessionIds: ['worker'],
        unarchiveSession: async () => undefined,
      },
    });
    await seedTask(service, 'worker');
    await service.notifyArchived('worker');
    expect(await readArchiveNotices(root)).toHaveLength(1);

    await expect(service.restoreSession('worker', { pin: false })).resolves.toMatchObject({
      taskRestored: true,
    });
    expect(await readArchiveNotices(root)).toEqual([]);

    const { session } = dispatchSession();
    const injected = await runPreStep(
      base,
      { agent: { session }, step: 1 },
      { kind: 'enter', messages: [larkMessage()] },
    );
    const text = textOf(
      injected.messages.find(
        (m) => m.source.kind === TASK_LOG_SOURCE_KIND,
      ) as Decision['messages'][number],
    );
    expect(text).not.toContain('<task_session_archived');
  });

  it('没有工作区或没有对应任务时不写记录', async () => {
    const { service } = startRow();
    await seedTask(service, 'worker');
    await service.notifyArchived('unknown');
    expect(await readArchiveNotices(root)).toEqual([]);

    writeFileSync(
      join(home, 'lark-bridge', 'state.json'),
      JSON.stringify({ workspaceRoot: null, sessionId: 'dispatch' }),
      'utf8',
    );
    await expect(service.notifyArchived('worker')).resolves.toBeUndefined();
    expect(await readArchiveNotices(root)).toEqual([]);
  });
});
