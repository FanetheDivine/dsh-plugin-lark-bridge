/**
 * `lark_notify` 工具：以 bot 身份向已绑定用户发送飞书消息。
 * 导出 NOTIFY_TOOL 与 sendNotification。
 */
import { randomUUID } from 'node:crypto';
import type { LarkCli } from './cli.ts';
import type { PluginConfig } from './config.ts';
import { MAX_MESSAGE_CHARS, NOTIFY_TOOL_NAME } from './constants.ts';
import { BridgeError } from './errors.ts';
import type { ToolDefinition, ToolRunContext } from './types.ts';
import { describeError, splitText } from './utils.ts';

/** 发送结果。 */
export interface NotifyResult {
  readonly ok: boolean;
  readonly parts?: number;
  readonly messageId?: string;
  readonly error?: { readonly code: string; readonly message: string };
}

/** 发送依赖。 */
export interface NotifyDeps {
  readonly getConfig: () => Readonly<PluginConfig>;
  readonly getCli: () => LarkCli;
  /** 当前可用的用户 open_id；未知时返回 undefined。 */
  readonly getOwner: () => string | undefined;
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
  const text = (args as Record<string, unknown>)['text'];
  if (typeof text !== 'string' || text.trim() === '') {
    return { ok: false, error: { code: 'invalid-text', message: 'text 必须是非空字符串' } };
  }
  const owner = deps.getOwner();
  if (owner === undefined || owner === '') {
    return {
      ok: false,
      error: { code: 'owner-missing', message: '尚未确定已绑定用户，请先在配置页完成鉴权' },
    };
  }
  const config = deps.getConfig();
  const parts = splitText(text, MAX_MESSAGE_CHARS);
  const baseKey = `lark-notify-${randomUUID()}`;
  let first: string | undefined;
  for (const [index, part] of parts.entries()) {
    try {
      const value = await deps
        .getCli()
        .json([
          '--profile',
          config.profile,
          'im',
          '+messages-send',
          '--as',
          'bot',
          '--user-id',
          owner,
          '--text',
          part,
          '--idempotency-key',
          `${baseKey}-${index}`.slice(0, 50),
        ]);
      const record =
        typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
      first ??= typeof record['message_id'] === 'string' ? record['message_id'] : undefined;
    } catch (error) {
      return {
        ok: false,
        error: { code: 'send-failed', message: describeError(error) },
      };
    }
  }
  return { ok: true, parts: parts.length, ...(first === undefined ? {} : { messageId: first }) };
}

/** 构造工具定义。 */
export function buildNotifyTool(deps: NotifyDeps): ToolDefinition {
  return {
    name: NOTIFY_TOOL_NAME,
    description:
      '以飞书机器人身份给已绑定的用户发送消息。只发往用户与机器人的私聊，不接受其他接收目标。',
    parameters: {
      text: {
        type: 'string',
        description: '要发送给用户的文本；过长时插件自动按顺序拆分',
        required: true,
      },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          parts: { type: 'integer' },
          messageId: { type: 'string' },
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
          return [{ type: 'text', text: `已发送给用户（${result.parts ?? 1} 条）` }];
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
