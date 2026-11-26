/**
 * `lark_notify` 成功结果的正文卡片节点：从调用参数取完整文本，注册 Conversation Definition。
 * 卡片放在轮次层级，现有结果文本只用于确认发送成功。
 */
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-client-ui-chat/client';
import type {
  ConversationMatch,
  ConversationNodeContext,
  ConversationNodeDefinition,
} from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { SessionEvent } from '@deepseek-ai/dsh-session/types';

/** 正文卡片的 Chat 节点 kind，同时是渲染槽位的注册键。 */
export const NOTIFY_NODE_KIND = 'lark-notify';

/** Definition 的 kind。 */
export const NOTIFY_DEFINITION_KIND = 'lark-notify-result';

/** 工具名。 */
const NOTIFY_TOOL = 'lark_notify';

/** 成功结果：新文案带消息标识，历史文案带分段数；两者都识别，使旧会话的卡片继续显示。 */
const SUCCESS_RESULT =
  /^(?:已(?:发送|回复)给用户（[1-9]\d* 条）|已发送给用户(?:（消息 [^）\s]+）)?)$/;

/** 卡片展示的数据：正文、卡片模式的总结、所属任务与可选的会话。 */
export interface NotifyCardData {
  /** 文本模式的正文，或卡片模式的完整 Markdown。 */
  readonly text: string;
  /** 卡片模式的一句总结。 */
  readonly summary?: string;
  /** 关联的任务标识，取自调用参数。 */
  readonly taskId?: string;
  /** 任务会话标识（新结果）或来源会话标识（历史结果），取自结果展示元数据。 */
  readonly sessionId?: string;
}

declare module '@deepseek-ai/dsh-client-ui-chat/client' {
  interface ChatNodeDataMap {
    /** 一次成功 `lark_notify` 的完整正文。 */
    'lark-notify': NotifyCardData;
  }
}

/** 从调用参数读取的展示字段。 */
interface NotifyArgs {
  readonly text: string;
  readonly summary?: string;
  readonly taskId?: string;
}

/** 取非空字符串字段。 */
function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

/**
 * 解析 `lark_notify` 的调用参数。
 * @param raw - `tool/call` 的参数字符串。
 * @returns 完整正文、卡片模式的总结与任务标识；缺失、非法 JSON 或类型不符时正文为空字符串。
 */
export function parseNotifyArgs(raw: string | undefined): NotifyArgs {
  if (raw === undefined || raw === '') return { text: '' };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { text: '' };
  }
  if (typeof value !== 'object' || value === null) return { text: '' };
  const record = value as Record<string, unknown>;
  const text = typeof record.text === 'string' ? record.text : '';
  const summary = record.mode === 'card' ? nonEmpty(record.summary) : undefined;
  const taskId = nonEmpty(record.task_id);
  return {
    text,
    ...(summary === undefined ? {} : { summary }),
    ...(taskId === undefined ? {} : { taskId }),
  };
}

/**
 * 解析 `lark_notify` 的调用参数，只读取完整 `text`。
 * @param raw - `tool/call` 的参数字符串。
 * @returns 原始正文；缺失、非法 JSON 或类型不符时为空字符串。
 */
export function parseNotifyText(raw: string | undefined): string {
  return parseNotifyArgs(raw).text;
}

/** 从工具结果的展示元数据读取非空会话标识：优先任务会话，兼容历史的来源会话。 */
function parseNotifySessionId(meta: unknown): string | undefined {
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return undefined;
  const record = meta as Record<string, unknown>;
  return nonEmpty(record.taskSessionId) ?? nonEmpty(record.sessionId);
}

/** 结果是单条文本时返回它；其余形状不提供读数。 */
function singleText(event: SessionEvent<'tool/result'>): string | undefined {
  const content = event.data.message.content;
  if (content.length !== 1) return undefined;
  const only = content[0];
  return only?.type === 'text' ? only.text : undefined;
}

/**
 * 判断结果是否是一次成功发送。
 * @param event - `tool/result` 事件。
 * @returns 只有追加到可见面的现有成功结果返回 true。
 */
export function isSuccessfulNotifyResult(event: SessionEvent<'tool/result'>): boolean {
  if (event.surfaceOp !== 'append') return false;
  if (event.data.message.isError === true) return false;
  const text = singleText(event);
  return text !== undefined && SUCCESS_RESULT.test(text);
}

/** 匹配调用与成功结果；两者以同一个 callId 关联。 */
function matchNotify(event: { readonly type: string }): { id: string; role: 'start' } | null {
  if (event.type === 'tool/call') {
    const call = event as SessionEvent<'tool/call'>;
    return call.data.name === NOTIFY_TOOL ? { id: String(call.data.callId), role: 'start' } : null;
  }
  if (event.type !== 'tool/result') return null;
  const result = event as SessionEvent<'tool/result'>;
  return isSuccessfulNotifyResult(result)
    ? { id: String(result.data.message.source.callId), role: 'start' }
    : null;
}

/** 缓存一次结果对应的卡片内容；调用补载后重新解析。 */
interface CardSource {
  readonly data: NotifyCardData;
  readonly resultSeq: number;
  readonly call: object | undefined;
}

/** 结果事件到卡片内容的缓存。 */
const cardSources = new WeakMap<object, CardSource>();

/** 从 Context 匹配中分出调用与结果。 */
function notifyMatches(context: ConversationNodeContext): {
  call: ConversationMatch | undefined;
  result: ConversationMatch | undefined;
} {
  let call: ConversationMatch | undefined;
  let result: ConversationMatch | undefined;
  for (const match of context.matches) {
    if (match.event.type === 'tool/call') call ??= match;
    else if (match.event.type === 'tool/result') result = match;
  }
  return { call, result };
}

/** 读取调用参数；未加载到调用时返回 undefined。 */
function argsRawOf(call: ConversationMatch | undefined): string | undefined {
  if (call === undefined) return undefined;
  const event = call.event as SessionEvent<'tool/call'>;
  return typeof event.data.arguments === 'string' ? event.data.arguments : undefined;
}

/** 读取缓存或重新构造正文内容。 */
function cardSource(call: ConversationMatch | undefined, result: ConversationMatch): CardSource {
  const event = result.event as SessionEvent<'tool/result'>;
  const cached = cardSources.get(event);
  if (cached !== undefined && cached.call === call?.event) return cached;
  const sessionId = parseNotifySessionId(event.data.meta);
  const args = parseNotifyArgs(argsRawOf(call));
  const source: CardSource = {
    data: {
      text: args.text,
      ...(args.summary === undefined ? {} : { summary: args.summary }),
      ...(args.taskId === undefined ? {} : { taskId: args.taskId }),
      ...(sessionId === undefined ? {} : { sessionId }),
    },
    resultSeq: event.seq,
    call: call?.event,
  };
  cardSources.set(event, source);
  return source;
}

/** 正文卡片 Chat 节点。 */
interface NotifyNode {
  readonly key: string;
  readonly kind: typeof NOTIFY_NODE_KIND;
  readonly id: string;
  readonly target: 'chat';
  readonly anchorSeq: number;
  readonly location: ConversationMatch['location'];
  readonly visibility: 'visible';
  readonly groupTree: 'turn';
  readonly data: NotifyCardData;
}

/**
 * 把一次成功通知投影成只含正文的卡片节点。
 * @param context - 该调用的 Context。
 * @returns 成功结果与 nonempty 正文同时存在时返回卡片，否则返回 null。
 */
export function buildNotifyNode(context: ConversationNodeContext): NotifyNode | null {
  const { call, result } = notifyMatches(context);
  if (result === undefined) return null;
  const source = cardSource(call, result);
  if (source.data.text.trim() === '') return null;
  const current = context.current.get('chat') as NotifyNode | null | undefined;
  if (
    current !== null &&
    current !== undefined &&
    current.kind === NOTIFY_NODE_KIND &&
    current.data === source.data
  ) {
    return current;
  }
  return {
    key: context.key,
    kind: NOTIFY_NODE_KIND,
    id: context.id,
    target: 'chat',
    anchorSeq: source.resultSeq + 0.5,
    location: result.location,
    visibility: 'visible',
    groupTree: 'turn',
    data: source.data,
  };
}

/** 通知正文卡片 Definition。 */
export const notifyDefinition: ConversationNodeDefinition = {
  kind: NOTIFY_DEFINITION_KIND,
  target: 'chat',
  match: matchNotify,
  start: () => null,
  update: (context) => context.state,
  publication: () => 'immediate',
  buildViewNode: buildNotifyNode,
};

/**
 * 注册通知正文卡片 Definition。
 * @param ctx - 已注入 `uiConversation` 的客户端上下文。
 * @returns 注销函数。
 */
export function registerNotifyDefinition(ctx: Context): () => void {
  return ctx.uiConversation.events.register({
    ...notifyDefinition,
    match: {
      'tool/call': matchNotify,
      'tool/result': matchNotify,
    },
  });
}
