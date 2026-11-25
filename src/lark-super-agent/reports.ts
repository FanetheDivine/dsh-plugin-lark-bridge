/** 上报存档：校验参数、复制附件、写存档并把上报编号记到任务上。 */
import { copyFile, mkdir, stat, writeFile } from 'node:fs/promises';
import { basename, extname, isAbsolute, join, resolve } from 'node:path';
import { z } from 'zod';

import { REPORT_KINDS, type ReportKind, type ReportOrigin, type SendReportInput } from './api.ts';
import { commitFilesInQueue, gitErrorMessage, runSerial } from './git.ts';
import { createReportId } from './ids.ts';
import { atomicWriteJson, isoTime, readTaskState, TASKS_FILE } from './notes.ts';

export interface ValidatedReportInput {
  kind: ReportKind;
  text: string;
  files: string[];
  desc?: string;
}

export interface ArchivedReport {
  reportId: string;
  taskId: string;
  reportPath: string;
  files: string[];
  warning?: string;
}

export interface ReportStoreOptions {
  now?: () => Date;
  reportId?: (date: Date) => string;
  cwd?: string;
}

export type ReportDelivery = (report: ArchivedReport) => Promise<void> | void;

const kindSchema = z.enum(REPORT_KINDS);

/** 校验空参数与全部附件，返回解析后的绝对附件路径。 */
export async function validateReportInput(
  input: SendReportInput,
  cwd: string = process.cwd(),
): Promise<ValidatedReportInput> {
  const kind = kindSchema.safeParse((input as { kind?: unknown }).kind);
  if (!kind.success) {
    throw new Error(`send_report kind must be one of ${REPORT_KINDS.join(', ')}`);
  }
  const text = input.text ?? '';
  const files = input.files ?? [];
  if (!Array.isArray(files) || files.some((file) => typeof file !== 'string')) {
    throw new Error('send_report files must be an array of paths');
  }
  if (text.trim() === '' && files.length === 0) {
    throw new Error('send_report needs text or files');
  }
  const desc = input.desc?.trim();
  const invalid: string[] = [];
  const resolvedFiles: string[] = [];
  for (const file of files) {
    const path = isAbsolute(file) ? resolve(file) : resolve(cwd, file);
    resolvedFiles.push(path);
    if (file.trim() === '' || extname(path).toLowerCase() !== '.md') {
      invalid.push(file);
      continue;
    }
    try {
      if (!(await stat(path)).isFile()) invalid.push(file);
    } catch {
      invalid.push(file);
    }
  }
  if (invalid.length > 0) {
    throw new Error(`send_report files must be existing .md files: ${invalid.join(', ')}`);
  }
  return {
    kind: kind.data,
    text,
    files: resolvedFiles,
    ...(desc === undefined || desc === '' ? {} : { desc }),
  };
}

function reportMarkdown(input: {
  reportId: string;
  sessionId: string;
  taskId: string;
  kind: ReportKind;
  origin: ReportOrigin;
  desc?: string;
  time: string;
  files: readonly string[];
  text: string;
}): string {
  const files =
    input.files.length === 0
      ? 'files: []'
      : `files:\n${input.files.map((file) => `  - ${JSON.stringify(file)}`).join('\n')}`;
  return [
    '---',
    `reportId: ${JSON.stringify(input.reportId)}`,
    `sessionId: ${JSON.stringify(input.sessionId)}`,
    `taskId: ${JSON.stringify(input.taskId)}`,
    `kind: ${JSON.stringify(input.kind)}`,
    `origin: ${JSON.stringify(input.origin)}`,
    ...(input.desc === undefined ? [] : [`desc: ${JSON.stringify(input.desc)}`]),
    `time: ${JSON.stringify(input.time)}`,
    files,
    '---',
    '',
    input.text,
    '',
  ].join('\n');
}

/** 上报存档。文件、所属任务与限定路径提交在一个工作区队列中完成。 */
export class ReportStore {
  readonly root: string;
  private readonly now: () => Date;
  private readonly reportId: (date: Date) => string;
  private readonly cwd: string;

  constructor(root: string, options: ReportStoreOptions = {}) {
    this.root = root;
    this.now = options.now ?? (() => new Date());
    this.reportId = options.reportId ?? ((date) => createReportId(date));
    this.cwd = options.cwd ?? process.cwd();
  }

  /**
   * 保存一份上报。delivery 在写入后、提交前执行；提交失败转为 warning。
   * 参数校验、台账读取或投递失败均不会被 warning 吞掉。
   */
  async archiveReport(
    input: SendReportInput,
    callerSessionId: string,
    taskId: string,
    origin: ReportOrigin,
    delivery?: ReportDelivery,
  ): Promise<ArchivedReport> {
    const validated = await validateReportInput(input, this.cwd);
    if (callerSessionId.trim() === '') throw new Error('send_report needs a caller session id');
    if (taskId.trim() === '') throw new Error('send_report needs a task id');
    return runSerial(this.root, async () => {
      const state = await readTaskState(this.root);
      const task = state.tasks.find((item) => item.id === taskId);
      if (task === undefined) throw new Error(`task not found: ${taskId}`);
      const date = this.now();
      const reportId = this.reportId(date);
      if (!/^report-\d{14}-[0-9a-f]{6}$/.test(reportId)) {
        throw new Error(`invalid report id: ${reportId}`);
      }
      const directory = resolve(this.root, 'reports', taskId);
      const at = isoTime(date);
      const copiedNames = validated.files.map(
        (file, index) => `${reportId}-${index + 1}-${basename(file)}`,
      );
      const reportPath = resolve(directory, `${reportId}.md`);
      const copiedPaths = copiedNames.map((name) => resolve(directory, name));

      await mkdir(directory, { recursive: true });
      for (let index = 0; index < validated.files.length; index += 1) {
        const source = validated.files[index];
        const destination = copiedPaths[index];
        if (source === undefined || destination === undefined) continue;
        await copyFile(source, destination);
      }
      await writeFile(
        reportPath,
        reportMarkdown({
          reportId,
          sessionId: callerSessionId,
          taskId,
          kind: validated.kind,
          origin,
          ...(validated.desc === undefined ? {} : { desc: validated.desc }),
          time: at,
          files: copiedNames,
          text: validated.text,
        }),
        'utf8',
      );

      const commitPaths = [reportPath, ...copiedPaths];
      if (!task.reportIds.includes(reportId)) task.reportIds.push(reportId);
      task.updatedAt = at;
      await atomicWriteJson(join(this.root, TASKS_FILE), { version: 2, tasks: state.tasks });
      commitPaths.push(join(this.root, TASKS_FILE));

      const result: ArchivedReport = { reportId, taskId, reportPath, files: copiedPaths };
      await delivery?.(result);
      try {
        await commitFilesInQueue(this.root, commitPaths, `lark-super-agent: report ${reportId}`);
      } catch (error) {
        result.warning = `report ${reportId} was delivered but git commit failed: ${gitErrorMessage(error)}`;
      }
      return result;
    });
  }
}
