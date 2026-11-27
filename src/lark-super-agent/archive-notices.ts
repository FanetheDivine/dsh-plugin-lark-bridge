/**
 * 归档通知记录：调度工作区 `archive-notices.json` 中待注入的会话归档事件。
 * 归档时追加，调度会话注入后删除。导出 ARCHIVE_NOTICES_FILE、ArchiveNotice 与读写函数。
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { replaceFile } from '../atomic.ts';
import { runSerial } from './git.ts';

/** 记录文件名。 */
export const ARCHIVE_NOTICES_FILE = 'archive-notices.json';

/** 一条待注入的归档通知。 */
export interface ArchiveNotice {
  /** `<taskId>:<time>`，同一任务再次归档得到新 id。 */
  readonly id: string;
  readonly taskId: string;
  readonly sessionId: string;
  /** 带本机时区偏移的 ISO 时间。 */
  readonly time: string;
}

/** 文件内容。 */
interface ArchiveNoticeState {
  version: 1;
  notices: ArchiveNotice[];
}

/** 文件路径。 */
function noticesPath(root: string): string {
  return join(root, ARCHIVE_NOTICES_FILE);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 判断条目字段完整。 */
function isNotice(value: unknown): value is ArchiveNotice {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id !== '' &&
    typeof value.taskId === 'string' &&
    value.taskId !== '' &&
    typeof value.sessionId === 'string' &&
    value.sessionId !== '' &&
    typeof value.time === 'string' &&
    Number.isFinite(Date.parse(value.time))
  );
}

/** 读取文件；缺失、损坏或版本不符时按空处理。 */
async function readState(root: string): Promise<ArchiveNoticeState> {
  try {
    const parsed: unknown = JSON.parse(await readFile(noticesPath(root), 'utf8'));
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.notices)) {
      return { version: 1, notices: [] };
    }
    return { version: 1, notices: parsed.notices.filter(isNotice) };
  } catch {
    return { version: 1, notices: [] };
  }
}

/** 原子写回整个文件。 */
async function writeState(root: string, state: ArchiveNoticeState): Promise<void> {
  const file = noticesPath(root);
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await rm(file, { force: true });
  await replaceFile(temporary, file);
}

/**
 * 读取全部待注入记录，按归档时间升序。
 * @param root - 调度工作区根。
 */
export async function readArchiveNotices(root: string): Promise<ArchiveNotice[]> {
  const state = await readState(root);
  return state.notices
    .map((notice) => ({ ...notice }))
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time) || a.id.localeCompare(b.id));
}

/**
 * 追加一条记录；同 id 已存在时跳过。
 * @param root - 调度工作区根。
 * @param notice - 待注入记录。
 */
export function appendArchiveNotice(
  root: string,
  notice: ArchiveNotice,
): Promise<'written' | 'duplicate'> {
  return runSerial(root, async () => {
    const state = await readState(root);
    if (state.notices.some((item) => item.id === notice.id)) return 'duplicate';
    await writeState(root, { version: 1, notices: [...state.notices, { ...notice }] });
    return 'written';
  });
}

/**
 * 删除满足条件的记录。
 * @param root - 调度工作区根。
 * @param predicate - 命中时删除。
 * @returns 删除的条数。
 */
export function removeArchiveNotices(
  root: string,
  predicate: (notice: ArchiveNotice) => boolean,
): Promise<number> {
  return runSerial(root, async () => {
    const state = await readState(root);
    const kept = state.notices.filter((notice) => !predicate(notice));
    const removed = state.notices.length - kept.length;
    if (removed === 0) return 0;
    await writeState(root, { version: 1, notices: kept });
    return removed;
  });
}