import { chmod, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  REPORT_KINDS,
  type ReportKind,
  type SendReportInput,
} from '../src/lark-super-agent/api.ts';
import { runGit } from '../src/lark-super-agent/git.ts';
import { NotesStore, readTaskState } from '../src/lark-super-agent/notes.ts';
import {
  type ArchivedReport,
  ReportStore,
  validateReportInput,
} from '../src/lark-super-agent/reports.ts';

const directories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lark-super-agent-reports-'));
  directories.push(directory);
  return directory;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** 建立一个管理 `worker` 会话的任务。 */
async function workerTask(root: string, title = '任务'): Promise<string> {
  const { taskId } = await new NotesStore(root).createTask({
    title,
    sessionId: 'worker',
    workspaceId: null,
    cwd: '/work/worker',
    message: { text: title },
  });
  return taskId;
}

beforeAll(async () => {
  await runGit(['--version']);
  process.env.GIT_CONFIG_COUNT = '2';
  process.env.GIT_CONFIG_KEY_0 = 'user.name';
  process.env.GIT_CONFIG_VALUE_0 = 'Lark Super Agent Test';
  process.env.GIT_CONFIG_KEY_1 = 'user.email';
  process.env.GIT_CONFIG_VALUE_1 = 'lark-super-agent@example.invalid';
});

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('lark-super-agent reports', { timeout: 30000 }, () => {
  it('复制附件并在 front matter 记录来源与说明', async () => {
    const root = await temporaryDirectory();
    const caller = await temporaryDirectory();
    const attachment = join(caller, 'answer.md');
    await writeFile(attachment, '# Copied\n', 'utf8');
    const taskId = await workerTask(root);
    const reportId = 'report-20260102030405-aabbcc';
    const result = await new ReportStore(root, { reportId: () => reportId }).archiveReport(
      {
        kind: 'progress',
        text: '  exact text\nsecond line  ',
        files: [attachment],
        desc: ' 结论 ',
      },
      'worker',
      taskId,
      'send_report',
    );

    expect(result).toMatchObject({ reportId, taskId });
    expect(result.warning).toBeUndefined();
    expect(result.reportPath).toBe(join(root, 'reports', taskId, `${reportId}.md`));
    expect(result.files).toEqual([join(root, 'reports', taskId, `${reportId}-1-answer.md`)]);
    expect(await readFile(result.files[0] ?? '', 'utf8')).toBe('# Copied\n');

    const markdown = await readFile(result.reportPath, 'utf8');
    expect(markdown).toContain(`reportId: "${reportId}"`);
    expect(markdown).toContain('sessionId: "worker"');
    expect(markdown).toContain(`taskId: "${taskId}"`);
    expect(markdown).toContain('kind: "progress"');
    expect(markdown).toContain('origin: "send_report"');
    expect(markdown).toContain('desc: "结论"');
    expect(markdown).toMatch(/time: "\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}"/);
    expect(markdown).toContain(`files:\n  - "${reportId}-1-answer.md"`);
    expect(markdown.endsWith('\n  exact text\nsecond line  \n')).toBe(true);

    const [task] = (await readTaskState(root)).tasks;
    expect(task?.reportIds).toEqual([reportId]);
    expect((await runGit(['status', '--porcelain'], root)).stdout.trim()).toBe('');
  });

  it('说明为空时省略 desc 行，来源照实记录', async () => {
    const root = await temporaryDirectory();
    const taskId = await workerTask(root);
    const store = new ReportStore(root);
    const turning = await store.archiveReport(
      { kind: 'question', text: '要继续吗' },
      'worker',
      taskId,
      'turn_end',
    );
    expect(await readFile(turning.reportPath, 'utf8')).toContain('origin: "turn_end"');
    expect(await readFile(turning.reportPath, 'utf8')).not.toContain('desc:');

    const blank = await store.archiveReport(
      { kind: 'progress', text: '进展', desc: '   ' },
      'worker',
      taskId,
      'send_report',
    );
    expect(await readFile(blank.reportPath, 'utf8')).not.toContain('desc:');
    const [task] = (await readTaskState(root)).tasks;
    expect(task?.reportIds).toEqual([turning.reportId, blank.reportId]);
  });

  it('任务不存在时报错且不创建存储', async () => {
    const root = await temporaryDirectory();
    await expect(
      new ReportStore(root).archiveReport(
        { kind: 'progress', text: 'standalone' },
        'worker',
        'task-20260102030405-aaaa',
        'send_report',
      ),
    ).rejects.toThrow(/task not found: task-20260102030405-aaaa/);
    expect(await exists(join(root, 'reports'))).toBe(false);
    expect(await exists(join(root, '.git'))).toBe(false);
  });

  it('缺少调用方或任务标识时报错', async () => {
    const root = await temporaryDirectory();
    const taskId = await workerTask(root);
    const store = new ReportStore(root);
    await expect(
      store.archiveReport({ kind: 'progress', text: 'x' }, '  ', taskId, 'send_report'),
    ).rejects.toThrow('send_report needs a caller session id');
    await expect(
      store.archiveReport({ kind: 'progress', text: 'x' }, 'worker', ' ', 'send_report'),
    ).rejects.toThrow('send_report needs a task id');
    expect(await exists(join(root, 'reports'))).toBe(false);
  });

  it('kind 只接受 progress 与 question，空参数与非法附件前置报错', async () => {
    const root = await temporaryDirectory();
    const caller = await temporaryDirectory();
    await writeFile(join(caller, 'not-markdown.txt'), 'text', 'utf8');

    expect(REPORT_KINDS).toEqual(['progress', 'question']);
    await expect(
      validateReportInput({ kind: 'completed' as unknown as ReportKind, text: 'done' }),
    ).rejects.toThrow('send_report kind must be one of progress, question');
    await expect(
      validateReportInput({ text: 'done' } as unknown as SendReportInput),
    ).rejects.toThrow('send_report kind must be one of progress, question');
    await expect(validateReportInput({ kind: 'progress' })).rejects.toThrow(
      'send_report needs text or files',
    );
    await expect(validateReportInput({ kind: 'progress', text: '   ', files: [] })).rejects.toThrow(
      'send_report needs text or files',
    );
    await expect(
      validateReportInput({ kind: 'progress', files: ['missing.md'] }, caller),
    ).rejects.toThrow(/existing \.md files: missing\.md/);

    await expect(
      new ReportStore(root, { cwd: caller }).archiveReport(
        { kind: 'progress', files: ['not-markdown.txt', 'missing.md'] },
        'worker',
        'task-20260102030405-aaaa',
        'send_report',
      ),
    ).rejects.toThrow(/not-markdown\.txt, missing\.md/);
    expect(await exists(join(root, 'reports'))).toBe(false);
    expect(await exists(join(root, '.git'))).toBe(false);
  });

  it('校验结果裁剪说明并保留正文原文', async () => {
    await expect(validateReportInput({ kind: 'progress', text: ' 保留空白 ' })).resolves.toEqual({
      kind: 'progress',
      text: ' 保留空白 ',
      files: [],
    });
    await expect(
      validateReportInput({ kind: 'question', files: [], desc: '  说明  ' }),
    ).rejects.toThrow('send_report needs text or files');
    await expect(
      validateReportInput({ kind: 'question', text: '问', desc: '  说明  ' }),
    ).resolves.toEqual({ kind: 'question', text: '问', files: [], desc: '说明' });
    await expect(
      validateReportInput({ kind: 'question', text: '问', desc: '   ' }),
    ).resolves.toEqual({ kind: 'question', text: '问', files: [] });
  });

  it('每种上报类型都能存档并记到任务上', async () => {
    const root = await temporaryDirectory();
    const taskId = await workerTask(root);
    const store = new ReportStore(root);
    const ids: string[] = [];
    for (const kind of REPORT_KINDS) {
      const result = await store.archiveReport(
        { kind, text: kind },
        'worker',
        taskId,
        'send_report',
      );
      expect(await readFile(result.reportPath, 'utf8')).toContain(`kind: "${kind}"`);
      ids.push(result.reportId);
    }
    expect((await readTaskState(root)).tasks[0]?.reportIds).toEqual(ids);
    expect((await runGit(['status', '--porcelain'], root)).stdout.trim()).toBe('');
  });

  it('投递在写入之后、提交之前执行', async () => {
    const root = await temporaryDirectory();
    const taskId = await workerTask(root);
    const reportId = 'report-20260102030405-000001';
    const delivered: ArchivedReport[] = [];
    const result = await new ReportStore(root, { reportId: () => reportId }).archiveReport(
      { kind: 'progress', text: '投递正文' },
      'worker',
      taskId,
      'send_report',
      async (archived) => {
        expect(await readFile(archived.reportPath, 'utf8')).toContain('投递正文');
        delivered.push(archived);
      },
    );
    expect(delivered.map((archived) => archived.reportId)).toEqual([reportId]);
    expect(delivered[0]?.taskId).toBe(taskId);
    expect(result.warning).toBeUndefined();
    expect((await runGit(['status', '--porcelain'], root)).stdout.trim()).toBe('');
  });

  it('投递抛错时向上传播并跳过提交', async () => {
    const root = await temporaryDirectory();
    const taskId = await workerTask(root);
    const reportId = 'report-20260102030405-000002';
    await expect(
      new ReportStore(root, { reportId: () => reportId }).archiveReport(
        { kind: 'progress', text: '正文' },
        'worker',
        taskId,
        'send_report',
        () => {
          throw new Error('delivery failed');
        },
      ),
    ).rejects.toThrow('delivery failed');
    expect(await exists(join(root, 'reports', taskId, `${reportId}.md`))).toBe(true);
    expect((await runGit(['status', '--porcelain'], root)).stdout).not.toBe('');
  });

  it('提交失败时返回 warning 并保留上报文件', async () => {
    const root = await temporaryDirectory();
    const taskId = await workerTask(root);
    const hook = join(root, '.git', 'hooks', 'pre-commit');
    await writeFile(hook, '#!/bin/sh\necho no-report-commit >&2\nexit 1\n', 'utf8');
    await chmod(hook, 0o755);
    const report = await new ReportStore(root).archiveReport(
      { kind: 'progress', text: 'retained' },
      'worker',
      taskId,
      'send_report',
    );
    expect(report.warning).toMatch(/no-report-commit/);
    expect(await exists(report.reportPath)).toBe(true);
  });
});
