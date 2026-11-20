/**
 * `lark_notify` 工具：以 bot 身份向已绑定用户发送飞书消息，可选精确回复某条用户消息。
 * 导出 NOTIFY_TOOL 与 sendNotification。
 */
import { randomUUID } from 'node:crypto';
import type { LarkCli } from './cli.ts';
import { MAX_MESSAGE_CHARS, NOTIFY_TOOL_NAME } from './constants.ts';
import { BridgeError } from './errors.ts';
import type { ToolDefinition, ToolRunContext } from './types.ts';
import { describeError, splitText } from './utils.ts';

/** 发送结果。 */
export interface NotifyResult {
  readonly ok: boolean;
  readonly parts?: number;
  readonly messageId?: string;
  readonly replyTo?: string;
  readonly error?: { readonly code: string; readonly message: string };
}

/** 发送依赖。 */
export interface NotifyDeps {
  readonly getCli: () => LarkCli;
  /** 当前可用的用户 open_id；未知时返回 undefined。 */
  readonly getOwner: () => string | undefined;
}

/** 读取可选的 `reply_to`；类型不对时返回错误。 */
function readReplyTo(args: Record<string, unknown>): { replyTo?: string; error?: NotifyResult } {
  const value = args['reply_to'];
  if (value === undefined) return {};
  if (typeof value !== 'string' || value.trim() === '') {
    return {
      error: {
        ok: false,
        error: { code: 'invalid-reply-to', message: 'reply_to 必须是非空字符串' },
      },
    };
  }
  return { replyTo: value.trim() };
}

/**
 * 校验参数并发送通知。
 * @param deps - 配置、CLI 与用户标识来源。
 * @param args - 工具参数。
 * @returns 发送结果；失败以结果返回，不抛异常。
 */
export async function sendNotification(deps: NotifyDeps, args: unknown): Promise<NotifyResult> {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    return { ok: false, error: { code: 'invalid-args', message: '参数必须是对象' } };
  }
  const record = args as Record<string, unknown>;
  const text = record['text'];
  if (typeof text !== 'string' || text.trim() === '') {
    return { ok: false, error: { code: 'invalid-text', message: 'text 必须是非空字符串' } };
  }
  const reply = readReplyTo(record);
  if (reply.error !== undefined) return reply.error;
  const owner = deps.getOwner();
  if (owner === undefined || owner === '') {
    return {
      ok: false,
      error: { code: 'owner-missing', message: '尚未确定已绑定用户，请在终端登录后重新检测' },
    };
  }
  const parts = splitText(text, MAX_MESSAGE_CHARS);
  const baseKey = `lark-notify-${randomUUID()}`;
  let first: string | undefined;
  for (const [index, part] of parts.entries()) {
    const replyTo = index === 0 ? reply.replyTo : undefined;
    const target = replyTo === undefined ? ['--user-id', owner] : ['--message-id', replyTo];
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
            '--text',
            '-',
            '--idempotency-key',
            `${baseKey}-${index}`.slice(0, 50),
          ],
          { input: part },
        );
      const record =
        typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
      first ??= typeof record['message_id'] === 'string' ? record['message_id'] : undefined;
    } catch (error) {
      return {
        ok: false,
        error: {
          code: replyTo === undefined ? 'send-failed' : 'reply-failed',
          message: describeError(error),
        },
      };
    }
  }
  return {
    ok: true,
    parts: parts.length,
    ...(first === undefined ? {} : { messageId: first }),
    ...(reply.replyTo === undefined ? {} : { replyTo: reply.replyTo }),
  };
}

/** 构造工具定义。 */
export function buildNotifyTool(deps: NotifyDeps): ToolDefinition {
  return {
    name: NOTIFY_TOOL_NAME,
    description:
      '以飞书机器人身份给已绑定的用户发送消息。只发往用户与机器人的私聊，不接受其他接收目标。可选 reply_to 精确回复某条用户消息。',
    parameters: {
      text: {
        type: 'string',
        description: '要发送给用户的文本；过长时插件自动按顺序拆分',
        required: true,
      },
      reply_to: {
        type: 'string',
        description: '要回复的用户消息 message_id；省略时直接发送',
        required: false,
      },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          parts: { type: 'integer' },
          messageId: { type: 'string' },
          replyTo: { type: 'string' },
          error: {
            type: 'object',
            properties: { code: { type: 'string' }, message: { type: 'string' } },
            required: ['code', 'message'],
          },
        },
        required: ['ok'],
      },
      render: (_args, value) => {
        const result = value as unknown as NotifyResult;
        if (result.ok) {
          const action = result.replyTo === undefined ? '已发送给用户' : '已回复给用户';
          return [{ type: 'text', text: `${action}（${result.parts ?? 1} 条）` }];
        }
        const error = result.error ?? { code: 'unknown', message: '发送失败' };
        return [{ type: 'text', text: `发送失败（${error.code}）：${error.message}` }];
      },
    },
    async execute(args: unknown, _exec: ToolRunContext) {
      try {
        return await sendNotification(deps, args);
      } catch (error) {
        if (error instanceof BridgeError) {
          return { ok: false, error: { code: error.code, message: error.message } };
        }
        return { ok: false, error: { code: 'send-failed', message: describeError(error) } };
      }
    },
  };
}
