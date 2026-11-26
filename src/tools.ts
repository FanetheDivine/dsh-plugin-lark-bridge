/**
 * `lark_notify` 工具：以 bot 身份向已绑定用户发送飞书消息，支持文本与卡片两种模式、
 * 可选精确回复某条用户消息、可选关联任务。导出 NOTIFY_TOOL 与 sendNotification。
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { LarkCli } from './cli.ts';
import { MAX_MESSAGE_CHARS, NOTIFY_TOOL_NAME } from './constants.ts';
import { BridgeError } from './errors.ts';
import { buildCards } from './notify-card.ts';
import type { ResolvedTask } from './notify-tasks.ts';
import type { Agent, ToolDefinition, ToolRunContext } from './types.ts';
import { describeError, splitText } from './utils.ts';

/** 发送结果：成功只带第一条消息的标识与可选的任务会话，失败带错误。 */
export interface NotifyResult {
  readonly ok: boolean;
  readonly messageId?: string;
  /** 带 task_id 且解析成功时的任务会话标识，只供界面使用。 */
  readonly taskSessionId?: string;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    /** 部分发送成功后失败时，已发出的条数。 */
    readonly sentCount?: number;
    /** 部分发送成功后失败时，第一条消息的标识。 */
    readonly firstMessageId?: string;
  };
}

/** 发送依赖。 */
export interface NotifyDeps {
  readonly getCli: () => LarkCli;
  /** 当前可用的用户 open_id；未知时返回 undefined。 */
  readonly getOwner: () => string | undefined;
  /** 按 task_id 解析未结束任务；缺省时带 task_id 的调用报错。 */
  readonly resolveTask?: (taskId: string) => Promise<ResolvedTask>;
}

/** 工具依赖：发送依赖加桥接会话判定。 */
export interface NotifyToolDeps extends NotifyDeps {
  /** 判断 agent 所在的会话是否是桥接会话。 */
  readonly isBridgeAgent: (agent: Agent) => Promise<boolean>;
}

/** 参数 schema：`text` 必填，其余可选。 */
export const NOTIFY_ARGS_SCHEMA = z.object({
  text: z
    .string()
    .describe('要发送给用户的文本；card 模式下是完整 Markdown。过长时插件自动按顺序拆分'),
  reply_to: z.string().describe('要回复的用户消息 message_id；省略时直接发送').optional(),
  mode: z
    .enum(['text', 'card'])
    .describe('text（默认）发送纯文本；card 发送卡片：summary 常显，text 的完整 Markdown 默认收起')
    .optional(),
  summary: z.string().describe('card 模式必填：一句总结，例如「xxx 任务需要确认」').optional(),
  task_id: z
    .string()
    .describe('关联的任务 id；插件在通知开头补写「名称 (id)」，text 里不要重复')
    .optional(),
});

/**
 * 把 zod schema 转成工具声明用的纯 JSON 副本。
 * zod 在返回值上挂不可枚举的 `~standard` 键，宿主只接受可枚举字符串键，因此展开复制并剔除 `$schema`。
 */
function parametersOf(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _schema, ...parameters } = z.toJSONSchema(schema) as Record<string, unknown>;
  return parameters;
}

/** 构造失败结果。 */
function failure(code: string, message: string): NotifyResult {
  return { ok: false, error: { code, message } };
}

/** 非桥接会话的拒绝结果。 */
function notBridgeSession(): NotifyResult {
  return failure('not-bridge-session', 'lark_notify 只在桥接会话可用');
}

/** 判定 agent 可用调用本工具；缺失 agent 或判定异常时按不可用处理。 */
async function isAvailable(deps: NotifyToolDeps, agent: Agent | undefined): Promise<boolean> {
  if (agent === undefined) return false;
  try {
    return await deps.isBridgeAgent(agent);
  } catch {
    return false;
  }
}

/** 读取一个可选的非空字符串参数；类型不对时返回错误。 */
function readOptionalText(
  args: Record<string, unknown>,
  key: string,
  code: string,
): { value?: string; error?: NotifyResult } {
  const value = args[key];
  if (value === undefined) return {};
  if (typeof value !== 'string' || value.trim() === '') {
    return { error: failure(code, `${key} 必须是非空字符串`) };
  }
  return { value: value.trim() };
}

/** 一次待发送的消息。 */
interface Outgoing {
  readonly type: 'text' | 'interactive';
  readonly body: string;
}

/** 组织待发送内容：文本按上限分段，卡片按体积拆张。 */
function outgoingOf(
  mode: 'text' | 'card',
  text: string,
  summary: string | undefined,
  taskLabel: string | undefined,
): Outgoing[] {
  if (mode === 'card') {
    return buildCards({
      summary: summary ?? '',
      markdown: text,
      ...(taskLabel === undefined ? {} : { taskLabel }),
    }).map((card) => ({ type: 'interactive', body: JSON.stringify(card) }));
  }
  const full = taskLabel === undefined ? text : `${taskLabel}\n${text}`;
  return splitText(full, MAX_MESSAGE_CHARS).map((part) => ({ type: 'text', body: part }));
}

/** 解析 task_id；失败返回统一的错误结果。 */
async function resolveTaskOrFail(
  deps: NotifyDeps,
  taskId: string,
): Promise<{ task?: ResolvedTask; error?: NotifyResult }> {
  if (deps.resolveTask === undefined) {
    return { error: failure('task-ledger-unavailable', '任务台账不可用，无法按 task_id 发送') };
  }
  try {
    return { task: await deps.resolveTask(taskId) };
  } catch (error) {
    if (error instanceof BridgeError) return { error: failure(error.code, error.message) };
    return { error: failure('task-ledger-unavailable', describeError(error)) };
  }
}

/**
 * 校验参数并发送通知。
 * @param deps - 配置、CLI、用户标识与任务解析来源。
 * @param args - 工具参数。
 * @returns 发送结果；失败以结果返回，不抛异常。
 */
export async function sendNotification(deps: NotifyDeps, args: unknown): Promise<NotifyResult> {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    return failure('invalid-args', '参数必须是对象');
  }
  const record = args as Record<string, unknown>;
  const text = record['text'];
  if (typeof text !== 'string' || text.trim() === '') {
    return failure('invalid-text', 'text 必须是非空字符串');
  }
  const reply = readOptionalText(record, 'reply_to', 'invalid-reply-to');
  if (reply.error !== undefined) return reply.error;
  const rawMode = record['mode'];
  if (rawMode !== undefined && rawMode !== 'text' && rawMode !== 'card') {
    return failure('invalid-mode', 'mode 只能是 text 或 card');
  }
  const mode = rawMode === 'card' ? 'card' : 'text';
  const summary = readOptionalText(record, 'summary', 'invalid-summary');
  if (summary.error !== undefined) return summary.error;
  if (mode === 'card' && summary.value === undefined) {
    return failure('invalid-summary', 'card 模式必须提供非空 summary');
  }
  const taskArg = readOptionalText(record, 'task_id', 'invalid-task-id');
  if (taskArg.error !== undefined) return taskArg.error;
  const owner = deps.getOwner();
  if (owner === undefined || owner === '') {
    return failure('owner-missing', '尚未确定已绑定用户，请在终端登录后重新检测');
  }
  let task: ResolvedTask | undefined;
  if (taskArg.value !== undefined) {
    const resolved = await resolveTaskOrFail(deps, taskArg.value);
    if (resolved.error !== undefined) return resolved.error;
    task = resolved.task;
  }
  const outgoing = outgoingOf(
    mode,
    text,
    summary.value,
    task === undefined ? undefined : `${task.title} (${task.id})`,
  );
  const baseKey = `lark-notify-${randomUUID()}`;
  let first: string | undefined;
  for (const [index, item] of outgoing.entries()) {
    const replyTo = index === 0 ? reply.value : undefined;
    const target = replyTo === undefined ? ['--user-id', owner] : ['--message-id', replyTo];
    const content =
      item.type === 'text' ? ['--text', '-'] : ['--msg-type', 'interactive', '--content', '-'];
    try {
      const value = await deps
        .getCli()
        .json(
          [
            'im',
            replyTo === undefined ? '+messages-send' : '+messages-reply',
            '--as',
            'bot',
            ...target,
            ...content,
            '--idempotency-key',
            `${baseKey}-${index}`.slice(0, 50),
          ],
          { input: item.body },
        );
      const data =
        typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
      first ??= typeof data['message_id'] === 'string' ? data['message_id'] : undefined;
    } catch (error) {
      const code = replyTo === undefined ? 'send-failed' : 'reply-failed';
      const base = describeError(error);
      if (index === 0) return failure(code, base);
      return {
        ok: false,
        error: {
          code,
          message: `${base}（已发送 ${index}/${outgoing.length} 条${first === undefined ? '' : `，第一条消息 ${first}`}；只补发剩余部分，不要重发整批）`,
          sentCount: index,
          ...(first === undefined ? {} : { firstMessageId: first }),
        },
      };
    }
  }
  return {
    ok: true,
    ...(first === undefined ? {} : { messageId: first }),
    ...(task === undefined ? {} : { taskSessionId: task.sessionId }),
  };
}

/** 构造工具定义。 */
export function buildNotifyTool(deps: NotifyToolDeps): ToolDefinition {
  return {
    name: NOTIFY_TOOL_NAME,
    description:
      'lark_notify：以飞书机器人身份给已绑定的用户发送消息。只发往用户与机器人的私聊，不接受其他接收目标。可选 reply_to 精确回复某条用户消息；mode 为 card 时发送卡片，summary 常显、text 的完整 Markdown 默认收起；task_id 关联任务，插件在通知开头补写任务名。成功只返回第一条消息的标识。',
    parameters: parametersOf(NOTIFY_ARGS_SCHEMA),
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          messageId: { type: 'string' },
          taskSessionId: { type: 'string' },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              sentCount: { type: 'integer' },
              firstMessageId: { type: 'string' },
            },
            required: ['code', 'message'],
          },
        },
        required: ['ok'],
      },
      presentationMeta: (_args, value) => {
        const result = value as unknown as NotifyResult;
        return result.ok &&
          typeof result.taskSessionId === 'string' &&
          result.taskSessionId.trim() !== ''
          ? { taskSessionId: result.taskSessionId }
          : {};
      },
      render: (_args, value) => {
        const result = value as unknown as NotifyResult;
        if (result.ok) {
          const suffix = result.messageId === undefined ? '' : `（消息 ${result.messageId}）`;
          return [{ type: 'text', text: `已发送给用户${suffix}` }];
        }
        const error = result.error ?? { code: 'unknown', message: '发送失败' };
        if (error.code === 'not-bridge-session') return [{ type: 'text', text: error.message }];
        return [{ type: 'text', text: `发送失败（${error.code}）：${error.message}` }];
      },
    },
    async execute(args: unknown, exec: ToolRunContext) {
      if (!(await isAvailable(deps, exec.agent))) return notBridgeSession();
      try {
        return await sendNotification(deps, args);
      } catch (error) {
        if (error instanceof BridgeError) return failure(error.code, error.message);
        return failure('send-failed', describeError(error));
      }
    },
  };
}
