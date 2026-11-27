/** 投递给调度会话的消息块：上报（只带路径）、轮次失败与会话归档。 */

/** 一条未读报告的引用。 */
export interface UnreadReportRef {
  taskId: string;
  reportId: string;
  /** 相对调度工作区根的路径，以 `/` 分隔。 */
  path: string;
}

/** 新建调度会话时附带的任务快照条目。 */
export interface TaskSnapshotRef {
  id: string;
  title: string;
  status: string;
  workspaceId: string | null;
  sessionId: string;
}

/** 上报消息块的输入；路径相对调度工作区根、以 `/` 分隔。 */
export interface TaskSessionMessageInput {
  sessionId: string;
  reportId: string;
  taskId: string;
  kind: string;
  origin: string;
  reportPath: string;
  attachmentPaths?: readonly string[];
  /** 全部未读报告；省略时省略未读段。 */
  unreadReports?: readonly UnreadReportRef[];
  /** 仅新建会话时提供。 */
  snapshot?: readonly TaskSnapshotRef[];
}

/** 上报块内的必读说明。 */
export const TASK_SESSION_INSTRUCTIONS =
  'Read the task entry in message-task-status.json and every report listed above before you reply.';

/** 失败通知块的输入。 */
export interface TaskSessionFailureInput {
  sessionId: string;
  taskId: string;
  error: unknown;
}

/** XML 属性值使用实体转义。 */
export function escapeXmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/** 内容中的闭合标签加反斜杠，保持外层块结构完整。 */
function escapeClosingTags(text: string, names: readonly string[]): string {
  let escaped = text;
  for (const name of names) escaped = escaped.replaceAll(`</${name}>`, `<\\/${name}>`);
  return escaped;
}

const MESSAGE_TAGS = [
  'report_path',
  'attachment_paths',
  'unread_report',
  'unread_reports',
  'task_snapshot',
  'instructions',
  'task_session_message',
] as const;

/** 生成上报投递块：属性、报告路径、未读报告、任务快照与必读说明。 */
export function taskSessionMessage(input: TaskSessionMessageInput): string {
  const attributes = [
    `sessionid="${escapeXmlAttribute(input.sessionId)}"`,
    `reportid="${escapeXmlAttribute(input.reportId)}"`,
    `taskid="${escapeXmlAttribute(input.taskId)}"`,
    `kind="${escapeXmlAttribute(input.kind)}"`,
    `origin="${escapeXmlAttribute(input.origin)}"`,
  ];
  const snapshot =
    input.snapshot === undefined || input.snapshot.length === 0
      ? []
      : [
          '<task_snapshot>',
          ...input.snapshot.map(
            (task) =>
              `<task id="${escapeXmlAttribute(task.id)}" title="${escapeXmlAttribute(task.title)}" status="${escapeXmlAttribute(task.status)}" workspace="${escapeXmlAttribute(task.workspaceId ?? '')}" session="${escapeXmlAttribute(task.sessionId)}"/>`,
          ),
          '</task_snapshot>',
        ];
  const unread =
    input.unreadReports === undefined
      ? []
      : [
          '<unread_reports>',
          ...input.unreadReports.map(
            (report) =>
              `<unread_report taskid="${escapeXmlAttribute(report.taskId)}" reportid="${escapeXmlAttribute(report.reportId)}">${escapeClosingTags(report.path, MESSAGE_TAGS)}</unread_report>`,
          ),
          '</unread_reports>',
        ];
  return [
    `<task_session_message ${attributes.join(' ')}>`,
    `<report_path>${escapeClosingTags(input.reportPath, MESSAGE_TAGS)}</report_path>`,
    '<attachment_paths>',
    escapeClosingTags((input.attachmentPaths ?? []).join('\n'), MESSAGE_TAGS),
    '</attachment_paths>',
    ...snapshot,
    ...unread,
    `<instructions>${TASK_SESSION_INSTRUCTIONS}</instructions>`,
    '</task_session_message>',
  ].join('\n');
}

/** 生成任务会话失败通知；失败原因最多保留 2000 个 UTF-16 字符。 */
export function taskSessionFailure(input: TaskSessionFailureInput): string {
  const reason = input.error instanceof Error ? input.error.message : String(input.error);
  const error = escapeClosingTags(reason.slice(0, 2000), ['error', 'task_session_failure']);
  return [
    `<task_session_failure sessionid="${escapeXmlAttribute(input.sessionId)}" taskid="${escapeXmlAttribute(input.taskId)}">`,
    '<error>',
    error,
    '</error>',
    '</task_session_failure>',
  ].join('\n');
}

/** 生成会话归档通知。 */
export function taskSessionArchived(input: { sessionId: string; taskId: string }): string {
  return `<task_session_archived sessionid="${escapeXmlAttribute(input.sessionId)}" taskid="${escapeXmlAttribute(input.taskId)}"/>`;
}
