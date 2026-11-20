// 事件桥测试：过滤、去重、队列批量注入、静默窗口与生命周期。
import { EventEmitter } from 'node:events';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { AuthSnapshot } from '../src/auth.ts';
import { acceptEvent, EventBridge, type FeishuEvent, formatLarkMessage } from '../src/bridge.ts';
import { INJECT_SILENCE_MS } from '../src/constants.ts';
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
  options: {
    injectImpl?: () => Promise<{ sessionId: string; created: boolean }>;
    json?: () => Promise<unknown>;
  } = {},
) {
  const dir = await mkdtemp(path.join(tmpdir(), 'lark-bridge-events-'));
  const store = new StateStore(path.join(dir, 'state.json'));
  const inject = vi.fn(options.injectImpl ?? (async () => ({ sessionId: 's1', created: true })));
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

  it('工作区无效时 sync 保持消费者运行', async () => {
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

    expect(instance.running).toBe(true);
    expect(spawn).toHaveBeenCalledTimes(1);
    instance.stop();
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
  it('静默 15 秒后注入', async () => {
    vi.useFakeTimers();
    try {
      const { instance, inject } = await bridge();
      expect(await instance.handleEvent(event())).toBe(true);
      expect(inject).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(INJECT_SILENCE_MS);
      expect(inject).toHaveBeenCalledTimes(1);
      expect(inject.mock.calls[0]?.[0]).toContain('你好');
    } finally {
      vi.useRealTimers();
    }
  });

  it('15 秒内的多条消息合并为一次注入并按时间排序', async () => {
    vi.useFakeTimers();
    try {
      const { instance, inject } = await bridge();
      const now = Date.now();
      await instance.handleEvent(
        event({ message_id: 'om_a', timestamp: String(now - 3_000), content: 'A' }),
      );
      await instance.handleEvent(
        event({ message_id: 'om_b', timestamp: String(now - 1_000), content: 'B' }),
      );
      await instance.handleEvent(
        event({ message_id: 'om_c', timestamp: String(now - 2_000), content: 'C' }),
      );
      await vi.advanceTimersByTimeAsync(INJECT_SILENCE_MS);
      expect(inject).toHaveBeenCalledTimes(1);
      const text = String(inject.mock.calls[0]?.[0]);
      expect(text.indexOf('A')).toBeLessThan(text.indexOf('C'));
      expect(text.indexOf('C')).toBeLessThan(text.indexOf('B'));
      expect(text.match(/<lark-message /g)).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('新消息重置静默计时', async () => {
    vi.useFakeTimers();
    try {
      const { instance, inject } = await bridge();
      await instance.handleEvent(event({ message_id: 'om_a' }));
      await vi.advanceTimersByTimeAsync(10_000);
      await instance.handleEvent(event({ message_id: 'om_b' }));
      await vi.advanceTimersByTimeAsync(10_000);
      expect(inject).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(inject).toHaveBeenCalledTimes(1);
      expect(String(inject.mock.calls[0]?.[0]).match(/<lark-message /g)).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('重复消息只入队一次', async () => {
    vi.useFakeTimers();
    try {
      const { instance, inject } = await bridge();
      expect(await instance.handleEvent(event({ message_id: 'om_a' }))).toBe(true);
      expect(await instance.handleEvent(event({ message_id: 'om_a' }))).toBe(false);
      await vi.advanceTimersByTimeAsync(INJECT_SILENCE_MS);
      expect(inject).toHaveBeenCalledTimes(1);
      expect(String(inject.mock.calls[0]?.[0]).match(/<lark-message /g)).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('注入进行中到达的消息重新计时后再注入', async () => {
    vi.useFakeTimers();
    try {
      let release: (() => void) | undefined;
      const { instance, inject } = await bridge(ready(), true, {
        injectImpl: () =>
          new Promise((resolve) => {
            release = () => resolve({ sessionId: 's1', created: true });
          }),
      });
      await instance.handleEvent(event({ message_id: 'om_a' }));
      await vi.advanceTimersByTimeAsync(INJECT_SILENCE_MS);
      expect(inject).toHaveBeenCalledTimes(1);
      await instance.handleEvent(event({ message_id: 'om_b' }));
      release?.();
      await vi.advanceTimersByTimeAsync(0);
      expect(inject).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(INJECT_SILENCE_MS);
      expect(inject).toHaveBeenCalledTimes(2);
      expect(String(inject.mock.calls[1]?.[0])).toContain('message_id="om_b"');
    } finally {
      vi.useRealTimers();
    }
  });

  it('早于监听启动的消息被过滤', async () => {
    vi.useFakeTimers();
    try {
      const { spawn } = consumer();
      const dir = await mkdtemp(path.join(tmpdir(), 'lark-bridge-events-'));
      const inject = vi.fn(async () => ({ sessionId: 's1', created: true }));
      const logger = { info: vi.fn(), warn: vi.fn() };
      const instance = new EventBridge({
        getCli: () => ({ spawn }) as never,
        getAuth: () => ready(),
        getWorkspaceReady: () => true,
        store: new StateStore(path.join(dir, 'state.json')),
        sessions: { inject } as never,
        logger,
      });
      instance.start();
      const old = String(Date.now() - 60_000);
      expect(await instance.handleEvent(event({ message_id: 'om_old', timestamp: old }))).toBe(
        false,
      );
      await vi.advanceTimersByTimeAsync(INJECT_SILENCE_MS);
      expect(inject).not.toHaveBeenCalled();
      const filtered = logger.warn.mock.calls
        .map((call) => String(call[0]))
        .find((line) => line.includes('filtered om_old'));
      expect(filtered).toMatch(/created=\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
      expect(filtered).toMatch(/received=\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
      instance.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('注入失败后整批丢弃，下一条消息正常注入', async () => {
    vi.useFakeTimers();
    try {
      let fail = true;
      const { instance, inject, logger } = await bridge(ready(), true, {
        injectImpl: async () => {
          if (fail) throw new Error('workspace-unregistered');
          return { sessionId: 's1', created: true };
        },
      });
      await instance.handleEvent(event({ message_id: 'om_a' }));
      await vi.advanceTimersByTimeAsync(INJECT_SILENCE_MS);
      const failed = logger.warn.mock.calls
        .map((call) => String(call[0]))
        .find((line) => line.includes('failed 1 message'));
      expect(failed).toContain('om_a@');
      expect(failed).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\/\d{4}-/);
      fail = false;
      await instance.handleEvent(event({ message_id: 'om_b' }));
      await vi.advanceTimersByTimeAsync(INJECT_SILENCE_MS);
      expect(inject).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('停止时清空队列与计时器', async () => {
    vi.useFakeTimers();
    try {
      const { instance, inject, logger } = await bridge();
      await instance.handleEvent(event({ message_id: 'om_a' }));
      instance.stop();
      await vi.advanceTimersByTimeAsync(INJECT_SILENCE_MS);
      expect(inject).not.toHaveBeenCalled();
      const dropped = logger.warn.mock.calls
        .map((call) => String(call[0]))
        .find((line) => line.includes('dropped 1 queued message'));
      expect(dropped).toContain('om_a@');
    } finally {
      vi.useRealTimers();
    }
  });

  it('鉴权未就绪时记录丢弃', async () => {
    const { instance, inject, logger } = await bridge({
      ...ready(),
      ready: false,
      user: 'disconnected',
    });
    expect(await instance.handleEvent(event())).toBe(false);
    expect(inject).not.toHaveBeenCalled();
    expect(logger.warn.mock.calls.some((call) => String(call[0]).includes('auth not ready'))).toBe(
      true,
    );
  });

  it('工作区无效时注入失败并记录，不创建会话', async () => {
    vi.useFakeTimers();
    try {
      const { instance, inject, logger } = await bridge(ready(), false, {
        injectImpl: async () => {
          throw new Error('workspace-unregistered');
        },
      });
      expect(await instance.handleEvent(event())).toBe(true);
      await vi.advanceTimersByTimeAsync(INJECT_SILENCE_MS);
      expect(inject).toHaveBeenCalledTimes(1);
      expect(
        logger.warn.mock.calls.some((call) => String(call[0]).includes('failed 1 message')),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('忽略群聊、bot 消息与其他用户', async () => {
    const { instance, inject } = await bridge();
    expect(await instance.handleEvent(event({ chat_type: 'group' }))).toBe(false);
    expect(await instance.handleEvent(event({ sender_type: 'bot' }))).toBe(false);
    expect(await instance.handleEvent(event({ sender_id: 'ou_2' }))).toBe(false);
    expect(inject).not.toHaveBeenCalled();
  });

  it('缺少消息标识时丢弃', async () => {
    const { instance, inject } = await bridge();
    expect(await instance.handleEvent(event({ message_id: '', id: '' }))).toBe(false);
    expect(inject).not.toHaveBeenCalled();
  });

  it('引用回复读取被引消息后只注入一次', async () => {
    vi.useFakeTimers();
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
    expect(inject).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(INJECT_SILENCE_MS);
    expect(inject).toHaveBeenCalledTimes(1);
    const block = inject.mock.calls[0]?.[0] ?? '';
    expect(block).toContain('<quote message_id="om_old" from="user"');
    expect(block).toContain('被引原文');
    expect(json.mock.calls[0]?.[0]).toContain('user');
    vi.useRealTimers();
  });

  it('引用读取失败仍注入并记录警告', async () => {
    vi.useFakeTimers();
    const { instance, inject, logger } = await bridge(ready(), true, {
      json: async () => {
        throw new Error('mget failed');
      },
    });
    expect(await instance.handleEvent(event({ reply_to: 'om_missing' }))).toBe(true);
    await vi.advanceTimersByTimeAsync(INJECT_SILENCE_MS);
    const block = inject.mock.calls[0]?.[0] ?? '';
    expect(block).toContain('[引用内容读取失败]');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('cannot read quoted message om_missing'),
    );
    vi.useRealTimers();
  });
});
