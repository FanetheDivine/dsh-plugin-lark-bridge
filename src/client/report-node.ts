/**
 * `send_report` 成功结果的上报卡片节点：解析调用参数与结果，注册 Conversation Definition。
 * 卡片放在轮次层级，不进入过程分组，因此不受过程折叠影响。
 */
import type { Context } from '@deepseek-ai/cordis';
// Type-only：声明 `uiConversation` 服务，并把卡片数据合并进宿主 Chat 节点表。
import type {} from '@deepseek-ai/dsh-client-ui-chat/client';
import type {
  ConversationMatch,
  ConversationNodeContext,
  ConversationNodeDefinition,
} from '@deepseek-ai/dsh-client-ui-conversation/client';
import type { SessionEvent } from '@deepseek-ai/dsh-session/types';

/** 卡片的 Chat 节点 kind，同时是 `conversation.chat.node` 的注册键。 */
export const REPORT_NODE_KIND = 'lark-report';

/** Definition 的 kind；与节点 kind 分开，避免与渲染键混淆。 */
export const REPORT_DEFINITION_KIND = 'lark-report-result';

/** 工具名。 */
const SEND_REPORT_TOOL = 'send_report';

/** 卡片展示的数据。 */
export interface ReportCardData {
  /** 上报类型，未知值原样保留。 */
  readonly kind: string;
  /** 任务简介。 */
  readonly desc: string;
  /** 上报正文，Markdown。 */
  readonly text: string;
  /** 上报文件，保持调用顺序。 */
  readonly files: readonly string[];
  /** 上报编号。 */
  readonly reportId: string;
}

declare module '@deepseek-ai/dsh-client-ui-chat/client' {
  interface ChatNodeDataMap {
    /** 一次成功 `send_report` 的卡片内容。 */
    'lark-report': ReportCardData;
  }
}

/** 调用参数的可用子集。 */
export interface ReportArgs {
  readonly kind: string;
  readonly desc: string;
  readonly text: string;
  readonly files: readonly string[];
}

/** 解析后的文本字段：非字符串或空白按缺失处理。 */
function textField(value: unknown): string {
  return typeof value === 'string' ? value.trimEnd() : '';
}

/**
 * 解析 `send_report` 的调用参数 JSON。
 * @param raw - `tool/call` 的参数字符串；未加载到调用时为 undefined。
 * @returns 可展示的参数；解析失败或字段类型不符时该字段为空。
 */
export function parseReportArgs(raw: string | undefined): ReportArgs {
  const empty: ReportArgs = { kind: '', desc: '', text: '', files: [] };
  if (raw === undefined || raw === '') return empty;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (typeof value !== 'object' || value === null) return empty;
  const args = value as Record<string, unknown>;
  return {
    kind: textField(args.kind),
    desc: textField(args.desc),
    text: textField(args.text),
    files: Array.isArray(args.files)
      ? args.files.filter((file): file is string => typeof file === 'string' && file !== '')
      : [],
  };
}

/** 结果是单条文本时返回它；其余形状不提供读数。 */
function singleText(event: SessionEvent<'tool/result'>): string | undefined {
  const content = event.data.message.content;
  if (content.length !== 1) return undefined;
  const only = content[0];
  return only?.type === 'text' ? only.text : undefined;
}

/**
 * 读成功结果的投递回执。
 * @param event - `tool/result` 事件。
 * @returns 上报编号与任务编号；结果不是一次成功投递时返回 null。
 */
export function deliveryOf(
  event: SessionEvent<'tool/result'>,
): { reportId: string; taskId: string } | null {
  if (event.data.message.isError === true) return null;
  const text = singleText(event);
  if (text === undefined) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const receipt = value as Record<string, unknown>;
  if (receipt.delivered !== true) return null;
  if (typeof receipt.reportId !== 'string' || receipt.reportId === '') return null;
  return {
    reportId: receipt.reportId,
    taskId: typeof receipt.taskId === 'string' ? receipt.taskId : '',
  };
}

/**
 * 判断一个事件是否属于本插件的上报卡片。
 * 调用与成功结果都可作为起点：调用不在已加载窗口内时，结果独立产出卡片。
 * @param event - 任意会话事件。
 * @returns `send_report` 的调用或成功投递的结果返回匹配，其余返回 null。
 */
function matchReport(event: { readonly type: string }): { id: string; role: 'start' } | null {
  if (event.type === 'tool/call') {
    const call = event as SessionEvent<'tool/call'>;
    return call.data.name === SEND_REPORT_TOOL
      ? { id: String(call.data.callId), role: 'start' }
      : null;
  }
  if (event.type !== 'tool/result') return null;
  const result = event as SessionEvent<'tool/result'>;
  // 只认追加到可见面的原始结果；替换副本由宿主裁剪产生，不代表新的上报。
  if (result.surfaceOp !== 'append') return null;
  const receipt = deliveryOf(result);
  return receipt === null ? null : { id: String(result.data.message.source.callId), role: 'start' };
}

/** 归一化后的卡片内容，附带产出它的调用事件，便于判断是否需要重新解析。 */
interface CardSource {
  readonly data: ReportCardData;
  readonly resultSeq: number;
  readonly call: object | undefined;
}

/** 结果事件到卡片内容的缓存：结果或调用变化时重新解析。 */
const cardSources = new WeakMap<object, CardSource>();

/** 一次上报的两个匹配：调用与成功结果。 */
interface ReportMatches {
  readonly call: ConversationMatch | undefined;
  readonly result: ConversationMatch | undefined;
}

/** 从 Context 的匹配里分出调用与结果。 */
function reportMatches(context: ConversationNodeContext): ReportMatches {
  let call: ConversationMatch | undefined;
  let result: ConversationMatch | undefined;
  for (const match of context.matches) {
    if (match.event.type === 'tool/call') call ??= match;
    else if (match.event.type === 'tool/result') result = match;
  }
  return { call, result };
}

/** 从 `tool/call` 事件直接读参数；未加载到调用时返回 undefined。 */
function argsRawOf(call: ConversationMatch | undefined): string | undefined {
  if (call === undefined) return undefined;
  const event = call.event as SessionEvent<'tool/call'>;
  return typeof event.data.arguments === 'string' ? event.data.arguments : undefined;
}

/** 读缓存或重新构造卡片内容。 */
function cardSource(call: ConversationMatch | undefined, result: ConversationMatch): CardSource {
  const event = result.event as SessionEvent<'tool/result'>;
  const cached = cardSources.get(event);
  if (cached !== undefined && cached.call === call?.event) return cached;
  const args = parseReportArgs(argsRawOf(call));
  const receipt = deliveryOf(event);
  const source: CardSource = {
    data: {
      kind: args.kind,
      desc: args.desc,
      text: args.text,
      files: args.files,
      reportId: receipt?.reportId ?? '',
    },
    resultSeq: event.seq,
    call: call?.event,
  };
  cardSources.set(event, source);
  return source;
}

/** 上报卡片的 Chat 节点；`data` 与 `anchorSeq` 由调用方给出。 */
interface ReportNode {
  readonly key: string;
  readonly kind: typeof REPORT_NODE_KIND;
  readonly id: string;
  readonly target: 'chat';
  readonly anchorSeq: number;
  readonly location: ConversationMatch['location'];
  readonly visibility: 'visible';
  readonly groupTree: 'turn';
  readonly data: ReportCardData;
}

/**
 * 把一次成功上报投影成卡片节点。
 * @param context - 该上报的 Context。
 * @returns 卡片节点；调用尚未加载或结果不是成功投递时返回 null。
 */
export function buildReportNode(context: ConversationNodeContext): ReportNode | null {
  const { call, result } = reportMatches(context);
  if (result === undefined) return null;
  const source = cardSource(call, result);
  const current = context.current.get('chat') as ReportNode | null | undefined;
  if (
    current !== null &&
    current !== undefined &&
    current.kind === REPORT_NODE_KIND &&
    current.data === source.data
  ) {
    return current;
  }
  return {
    key: context.key,
    kind: REPORT_NODE_KIND,
    id: context.id,
    target: 'chat',
    // 紧跟结果之后，读作这次调用的结论。
    anchorSeq: source.resultSeq + 0.5,
    location: result.location,
    visibility: 'visible',
    groupTree: 'turn',
    data: source.data,
  };
}

/** 上报卡片 Definition；由调用方在 `uiConversation.events` 上注册。 */
export const reportDefinition: ConversationNodeDefinition = {
  kind: REPORT_DEFINITION_KIND,
  target: 'chat',
  match: matchReport,
  start: () => null,
  update: (context) => context.state,
  publication: () => 'immediate',
  buildViewNode: buildReportNode,
};

/**
 * 注册上报卡片 Definition。
 * @param ctx - 客户端上下文，需已注入 `uiConversation`。
 * @returns 注销函数。
 */
export function registerReportDefinition(ctx: Context): () => void {
  return ctx.uiConversation.events.register({
    ...reportDefinition,
    match: {
      'tool/call': matchReport,
      'tool/result': matchReport,
    },
  });
}
