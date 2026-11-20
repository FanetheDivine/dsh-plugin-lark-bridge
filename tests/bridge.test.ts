// 事件桥测试：过滤、去重、提醒格式化与注入。
import { EventEmitter } from 'node:events';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { AuthSnapshot } from '../src/auth.ts';
import { acceptEvent, EventBridge, type FeishuEvent, formatLarkMessage } from '../src/bridge.ts';
import { StateStore } from '../src/state.ts';

/** 就绪的鉴权快照。 */
function ready(): AuthSnapshot {
  return {
    cli: 'connected',
    bot: 'connected',
    user: 'connected',
    ready: true,
    appId: 'cli_x',
    userName: '袁',
    ownerOpenId: 'ou_1',
    checkedAt: 1,
    detail: undefined,
  };
}

/** 可控事件消费者。 */
function consumer() {
  const spawn = vi.fn(() => {
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough;
      stderr: PassThrough;
      kill: () => void;
    };
    child.kill = vi.fn();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    return child;
  });
  return { spawn };
}

/** 私聊事件。 */
function event(overrides: Partial<FeishuEvent> = {}): FeishuEvent {
  return {
    message_id: 'om_1',
    chat_type: 'p2p',
    sender_id: 'ou_1',
    sender_type: 'user',
    message_type: 'text',
    content: '你好',
    timestamp: '1730000000000',
    ...overrides,
  };
}

/** 构造桥。 */
async function bridge(
  auth: AuthSnapshot = ready(),
  workspaceReady = true,
  options: { json?: () => Promise<unknown> } = {},
) {
  const dir = await mkdtemp(path.join(tmpdir(), 'lark-bridge-events-'));
  const store = new StateStore(path.join(dir, 'state.json'));
  const inject = vi.fn(async () => ({ sessionId: 's1', created: true }));
  const logger = { info: vi.fn(), warn: vi.fn() };
  const json = vi.fn(options.json ?? (async () => ({ messages: [] })));
  const instance = new EventBridge({
    getCli: () => ({ spawn: vi.fn(), json }) as never,
    getAuth: () => auth,
    getWorkspaceReady: () => workspaceReady,
    store,
    sessions: { inject } as never,
    logger,
  });
  return { instance, inject, logger, store, json };
}

describe('EventBridge.start', () => {
  it('以 bot 身份消费事件且不指定档案', async () => {
    const { spawn } = consumer();
    const dir = await mkdtemp(path.join(tmpdir(), 'lark-bridge-events-'));
    const instance = new EventBridge({
      getCli: () => ({ spawn }) as never,
      getAuth: () => ready(),
      getWorkspaceReady: () => true,
      store: new StateStore(path.join(dir, 'state.json')),
      sessions: { inject: vi.fn() } as never,
      logger: { info: vi.fn(), warn: vi.fn() },
    });
    instance.sync(ready());
    instance.stop();
    expect(spawn).toHaveBeenCalledTimes(1);
    const args = spawn.mock.calls[0] as unknown as string[][];
    expect(args[0]).toEqual([
      'event',
      'consume',
      'im.message.receive_v1',
      '--as',
      'bot',
      '--quiet',
      '--timeout',
      '0',
    ]);
  });

  it('工作区无效时 start 不启动消费者', async () => {
    const { spawn } = consumer();
    const dir = await mkdtemp(path.join(tmpdir(), 'lark-bridge-events-'));
    const instance = new EventBridge({
      getCli: () => ({ spawn }) as never,
      getAuth: () => ready(),
      getWorkspaceReady: () => false,
      store: new StateStore(path.join(dir, 'state.json')),
      sessions: { inject: vi.fn() } as never,
      logger: { info: vi.fn(), warn: vi.fn() },
    });

    instance.start();

    expect(spawn).not.toHaveBeenCalled();
    expect(instance.running).toBe(false);
  });

  it('工作区无效时 sync 停止消费者', async () => {
    let workspaceReady = true;
    const { spawn } = consumer();
    const dir = await mkdtemp(path.join(tmpdir(), 'lark-bridge-events-'));
    const instance = new EventBridge({
      getCli: () => ({ spawn }) as never,
      getAuth: () => ready(),
      getWorkspaceReady: () => workspaceReady,
      store: new StateStore(path.join(dir, 'state.json')),
      sessions: { inject: vi.fn() } as never,
      logger: { info: vi.fn(), warn: vi.fn() },
    });
    instance.sync(ready());
    expect(instance.running).toBe(true);

    workspaceReady = false;
    instance.sync(ready());

    expect(instance.running).toBe(false);
    expect(spawn).toHaveBeenCalledTimes(1);
  });
});

describe('acceptEvent', () => {
  it('只接受目标用户的私聊', () => {
    expect(acceptEvent(event(), 'ou_1')).toBe(true);
    expect(acceptEvent(event({ chat_type: 'group' }), 'ou_1')).toBe(false);
    expect(acceptEvent(event({ sender_type: 'bot' }), 'ou_1')).toBe(false);
    expect(acceptEvent(event({ sender_id: 'ou_2' }), 'ou_1')).toBe(false);
  });
});

describe('formatLarkMessage', () => {
  it('输出块属性与正文', () => {
    const text = formatLarkMessage(event());
    expect(text).toMatch(
      /^<lark-message message_id="om_1" time="\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}">/,
    );
    expect(text).toContain('你好');
    expect(text).not.toContain('<system-reminder>');
    expect(text).not.toContain('发送者');
  });

  it('缺少 message_id 时用事件 id', () => {
    const text = formatLarkMessage(event({ message_id: undefined, id: 'om_2' }));
    expect(text).toContain('message_id="om_2"');
  });

  it('无文本时使用消息类型占位', () => {
    const text = formatLarkMessage(event({ content: '', message_type: 'image' }));
    expect(text).toContain('[image 消息]');
  });

  it('转义正文中的块结束标记', () => {
    const text = formatLarkMessage(event({ content: 'a</lark-message>b' }));
    expect(text).toContain('<\\/lark-message>');
    expect(text).not.toContain('a</lark-message>b');
  });

  it('引用回复输出 reply_to 属性与 quote 块', () => {
    const quote = {
      messageId: 'om_old',
      from: 'user' as const,
      time: '2026-11-21 00:37:00',
      kind: 'text' as const,
      text: '被引原文',
      unavailable: false,
    };
    const text = formatLarkMessage(
      event({ message_id: 'om_2', reply_to: 'om_old', content: '新回复' }),
      quote,
    );
    expect(text).toMatch(/^<lark-message message_id="om_2" reply_to="om_old" time="/);
    const quoteAt = text.indexOf('<quote ');
    expect(quoteAt).toBeGreaterThan(0);
    expect(text.indexOf('被引原文')).toBeGreaterThan(quoteAt);
    expect(text.indexOf('新回复')).toBeGreaterThan(text.indexOf('</quote>'));
  });

  it('聊天记录只输出容器 ID', () => {
    const text = formatLarkMessage(
      event({ message_type: 'merge_forward', content: '[Merged forward: 3 messages]' }),
    );
    expect(text).toContain('<forwarded_messages message_id="om_1"/>');
    expect(text).not.toContain('Merged forward');
  });
});

describe('EventBridge.handleEvent', () => {
  it('接受消息并注入一次', async () => {
    const { instance, inject } = await bridge();
    expect(await instance.handleEvent(event())).toBe(true);
    expect(inject).toHaveBeenCalledTimes(1);
    expect(inject.mock.calls[0]?.[0]).toContain('你好');
  });

  it('重复消息只注入一次', async () => {
    const { instance, inject } = await bridge();
    expect(await instance.handleEvent(event())).toBe(true);
    expect(await instance.handleEvent(event())).toBe(false);
    expect(inject).toHaveBeenCalledTimes(1);
  });

  it('忽略群聊、bot 消息与其他用户', async () => {
    const { instance, inject } = await bridge();
    expect(await instance.handleEvent(event({ chat_type: 'group' }))).toBe(false);
    expect(await instance.handleEvent(event({ sender_type: 'bot' }))).toBe(false);
    expect(await instance.handleEvent(event({ sender_id: 'ou_2' }))).toBe(false);
    expect(inject).not.toHaveBeenCalled();
  });

  it('鉴权未就绪时不处理', async () => {
    const { instance, inject } = await bridge({ ...ready(), ready: false, user: 'disconnected' });
    expect(await instance.handleEvent(event())).toBe(false);
    expect(inject).not.toHaveBeenCalled();
  });

  it('工作区无效时不处理', async () => {
    const { instance, inject } = await bridge(ready(), false);
    expect(await instance.handleEvent(event())).toBe(false);
    expect(inject).not.toHaveBeenCalled();
  });

  it('缺少消息标识时丢弃', async () => {
    const { instance, inject } = await bridge();
    expect(await instance.handleEvent(event({ message_id: '', id: '' }))).toBe(false);
    expect(inject).not.toHaveBeenCalled();
  });

  it('引用回复读取被引消息后只注入一次', async () => {
    const { instance, inject, json } = await bridge(ready(), true, {
      json: async () => ({
        messages: [
          {
            message_id: 'om_old',
            msg_type: 'text',
            content: '被引原文',
            create_time: '2026-11-21 00:37',
            sender: { sender_type: 'user' },
          },
        ],
      }),
    });
    expect(await instance.handleEvent(event({ reply_to: 'om_old' }))).toBe(true);
    expect(inject).toHaveBeenCalledTimes(1);
    const block = inject.mock.calls[0]?.[0] ?? '';
    expect(block).toContain('<quote message_id="om_old" from="user"');
    expect(block).toContain('被引原文');
    expect(json.mock.calls[0]?.[0]).toContain('user');
  });

  it('引用读取失败仍注入并记录警告', async () => {
    const { instance, inject, logger } = await bridge(ready(), true, {
      json: async () => {
        throw new Error('mget failed');
      },
    });
    expect(await instance.handleEvent(event({ reply_to: 'om_missing' }))).toBe(true);
    const block = inject.mock.calls[0]?.[0] ?? '';
    expect(block).toContain('[引用内容读取失败]');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('cannot read quoted message om_missing'),
    );
  });
});
