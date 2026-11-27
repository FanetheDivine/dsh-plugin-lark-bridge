/**
 * 任务日志注入：调度会话每次 pre-step 前，把会话事件日志里还没有的日志条目合成一条消息。
 * 没有注入过的会话按全新会话处理，先注入未结束任务快照。导出 TASK_LOG_SOURCE_KIND 与 TaskLogInjector。
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createUserMessage, type UserMessage } from '@deepseek-ai/dsh-llm';

import { isLarkMessage, isReminderMessage } from '../../message.ts';
import type { LarkSuperAgentService, Task } from '../api.ts';
import { escapeXmlAttribute, TASK_SESSION_INSTRUCTIONS } from '../blocks.ts';
import { workspaceRelative } from '../paths.ts';
import { readTaskLog, type TaskLogEntry } from '../task-log.ts';

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'lark-task-log': {
      kind: 'lark-task-log';
    };
  }
}

/** 日志注入消息的来源标识。 */
export const TASK_LOG_SOURCE_KIND = 'lark-task-log';

/** 最小会话结构：下一个可用 seq 与按 seq 读取事件。 */
export interface SessionLike {
  readonly seq: number;
  eventAt(seq: never): unknown;
}

/** 单个会话的扫描缓存。 */
interface ScanState {
  scanned: number;
  readonly injected: Set<string>;
  marked: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 内容中的闭合标签加反斜杠，保持外层块结构完整。 */
function escapeClosing(text: string, names: readonly string[]): string {
  let escaped = text;
  for (const name of names) escaped = escaped.replaceAll(`</${name}>`, `<\\/${name}>`);
  return escaped;
}

/** 一条日志的注入块。 */
function entryBlock(entry: TaskLogEntry): string {
  const attributes = [
    `id="${escapeXmlAttribute(entry.id)}"`,
    `taskid="${escapeXmlAttribute(entry.taskId)}"`,
    `sessionid="${escapeXmlAttribute(entry.sessionId)}"`,
    `time="${escapeXmlAttribute(entry.time)}"`,
    `type="${entry.type}"`,
    ...(entry.truncated === true ? ['truncated="true"'] : []),
  ];
  return `<task_log_entry ${attributes.join(' ')}>\n${escapeClosing(entry.text, ['task_log_entry'])}\n</task_log_entry>`;
}

/** 读取报告 front matter 里的时间；读取或解析失败时为 undefined。 */
async function reportTime(
  root: string,
  taskId: string,
  reportId: string,
): Promise<number | undefined> {
  try {
    const source = await readFile(join(root, 'reports', taskId, `${reportId}.md`), 'utf8');
    const match = /^time: (".*")$/m.exec(source);
    if (match?.[1] === undefined) return undefined;
    const parsed = Date.parse(JSON.parse(match[1]) as string);
    return Number.isFinite(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** 日志注入器。 */
export class TaskLogInjector {
  private readonly service: LarkSuperAgentService;
  private readonly scans = new Map<string, ScanState>();

  constructor(service: LarkSuperAgentService) {
    this.service = service;
  }

  /**
   * 增量扫描会话事件日志，取出已注入的条目 id。
   * 缓存只记录已扫描位置；缓存缺失或会话回退时从头重建。
   */
  private scan(sessionId: string, session: SessionLike): ScanState {
    let state = this.scans.get(sessionId);
    if (state === undefined || state.scanned > session.seq) {
      state = { scanned: 0, injected: new Set(), marked: false };
      this.scans.set(sessionId, state);
    }
    for (let seq = state.scanned; seq < session.seq; seq += 1) {
      const event = session.eventAt(seq as never);
      if (!isRecord(event) || event.type !== 'user/message') continue;
      const message = isRecord(event.data) ? event.data : undefined;
      const source = isRecord(message?.source) ? message.source : undefined;
      if (source?.kind !== TASK_LOG_SOURCE_KIND) continue;
      state.marked = true;
      const content = Array.isArray(message?.content) ? message.content : [];
      for (const block of content) {
        if (!isRecord(block) || block.type !== 'text' || typeof block.text !== 'string') continue;
        for (const match of block.text.matchAll(/<task_log_entry id="([^"]*)"/g)) {
          if (match[1] !== undefined) state.injected.add(match[1]);
        }
        for (const match of block.text.matchAll(/covers_entries="([^"]*)"/g)) {
          for (const id of (match[1] ?? '').split(',')) if (id !== '') state.injected.add(id);
        }
      }
    }
    state.scanned = session.seq;
    return state;
  }

  /** 读取全部未结束任务的日志，按时间升序。 */
  private async entriesOf(
    root: string,
    tasks: readonly Task[],
  ): Promise<Map<string, TaskLogEntry[]>> {
    const byTask = new Map<string, TaskLogEntry[]>();
    for (const task of tasks) byTask.set(task.id, await readTaskLog(root, task.id));
    return byTask;
  }

  /** 全新会话的快照与各任务最新报告之后的日志条目。 */
  private async snapshot(
    root: string,
    tasks: readonly Task[],
    byTask: Map<string, TaskLogEntry[]>,
  ): Promise<string> {
    const covered: string[] = [];
    const taskLines: string[] = [];
    const recent: TaskLogEntry[] = [];
    for (const task of tasks) {
      const entries = byTask.get(task.id) ?? [];
      covered.push(...entries.map((entry) => entry.id));
      const latest = task.reportIds.at(-1);
      const latestTime = latest === undefined ? undefined : await reportTime(root, task.id, latest);
      for (const entry of entries) {
        if (latestTime === undefined || Date.parse(entry.time) > latestTime) recent.push(entry);
      }
      const attributes = [
        `id="${escapeXmlAttribute(task.id)}"`,
        `title="${escapeXmlAttribute(task.title)}"`,
        `status="${task.status}"`,
        `workspace="${escapeXmlAttribute(task.workspaceId ?? '')}"`,
        `session="${escapeXmlAttribute(task.sessionId)}"`,
        `latest_report="${
          latest === undefined
            ? ''
            : escapeXmlAttribute(
                workspaceRelative(root, join(root, 'reports', task.id, `${latest}.md`)),
              )
        }"`,
      ];
      taskLines.push(`<task ${attributes.join(' ')}/>`);
    }
    const unread: string[] = [];
    for (const task of tasks) {
      const delivered = new Set(task.deliveredReportIds);
      for (const reportId of task.reportIds) {
        if (delivered.has(reportId)) continue;
        const path = workspaceRelative(root, join(root, 'reports', task.id, `${reportId}.md`));
        unread.push(
          `<unread_report taskid="${escapeXmlAttribute(task.id)}" reportid="${escapeXmlAttribute(reportId)}">${escapeClosing(path, ['unread_report'])}</unread_report>`,
        );
      }
    }
    recent.sort((a, b) => Date.parse(a.time) - Date.parse(b.time) || a.id.localeCompare(b.id));
    return [
      `<task_snapshot covers_entries="${escapeXmlAttribute(covered.join(','))}">`,
      ...taskLines,
      '</task_snapshot>',
      ...(unread.length === 0 ? [] : ['<unread_reports>', ...unread, '</unread_reports>']),
      `<instructions>${TASK_SESSION_INSTRUCTIONS}</instructions>`,
      ...recent.map(entryBlock),
    ].join('\n');
  }

  /**
   * 构造本次 pre-step 要注入的日志消息。
   * @param sessionId - 调度会话标识。
   * @param session - 调度会话，用于扫描完整事件日志。
   * @returns 需要注入的消息；没有新内容时为 undefined。
   */
  async build(sessionId: string, session: SessionLike): Promise<UserMessage | undefined> {
    const { root, tasks } = await this.service.taskLogContext();
    const state = this.scan(sessionId, session);
    const byTask = await this.entriesOf(root, tasks);
    let text: string;
    if (!state.marked) {
      text = await this.snapshot(root, tasks, byTask);
    } else {
      const unseen = [...byTask.values()]
        .flat()
        .filter((entry) => !state.injected.has(entry.id))
        .sort((a, b) => Date.parse(a.time) - Date.parse(b.time) || a.id.localeCompare(b.id));
      if (unseen.length === 0) return undefined;
      text = unseen.map(entryBlock).join('\n');
    }
    return createUserMessage({
      content: [{ type: 'text', text }],
      source: { kind: TASK_LOG_SOURCE_KIND },
    });
  }
}

/**
 * 日志注入消息在本批中的插入位置：桥接提醒之后、第一条 `<lark-message>` 之前。
 * @param messages - 本批消息。
 * @returns 插入下标。
 */
export function insertionIndex(messages: readonly UserMessage[]): number {
  const lark = messages.findIndex(
    (message) => isLarkMessage(message) && !isReminderMessage(message),
  );
  if (lark !== -1) return lark;
  let index = 0;
  while (index < messages.length && isReminderMessage(messages[index] as UserMessage)) index += 1;
  return index;
}
