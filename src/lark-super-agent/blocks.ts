/** 投递给调度会话的消息块：上报、轮次失败与会话归档。 */

/** 上报消息块的输入。 */
export interface TaskSessionMessageInput {
  sessionId: string;
  reportId: string;
  taskId: string;
  kind: string;
  origin: string;
  desc?: string;
  text?: string;
  files?: readonly string[];
}

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

const MESSAGE_TAGS = ['desc', 'text', 'files', 'task_session_message'] as const;

/** 生成上报投递块。`desc` 只在提供时出现。 */
export function taskSessionMessage(input: TaskSessionMessageInput): string {
  const attributes = [
    `sessionid="${escapeXmlAttribute(input.sessionId)}"`,
    `reportid="${escapeXmlAttribute(input.reportId)}"`,
    `taskid="${escapeXmlAttribute(input.taskId)}"`,
    `kind="${escapeXmlAttribute(input.kind)}"`,
    `origin="${escapeXmlAttribute(input.origin)}"`,
  ];
  const lines = [`<task_session_message ${attributes.join(' ')}>`];
  if (input.desc !== undefined && input.desc.trim() !== '') {
    lines.push('<desc>', escapeClosingTags(input.desc, MESSAGE_TAGS), '</desc>');
  }
  lines.push(
    '<text>',
    escapeClosingTags(input.text ?? '', MESSAGE_TAGS),
    '</text>',
    '<files>',
    escapeClosingTags((input.files ?? []).join('\n'), MESSAGE_TAGS),
    '</files>',
    '</task_session_message>',
  );
  return lines.join('\n');
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
