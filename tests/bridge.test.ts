// 事件桥测试：过滤、去重、立即注入、按创建时间串行投递与生命周期。
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

/** 清空当前微任务队列，让已排队的 handleEvent 继续走到入队并挂到投递链。 */
async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
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
  it('消息到达后立即注入，不等待静默窗口', async () => {
    vi.useFakeTimers();
    try {
      const { instance, inject } = await bridge();
      expect(await instance.handleEvent(event())).toBe(true);
      expect(inject).toHaveBeenCalledTimes(1);
      expect(inject.mock.calls[0]?.[0]).toContain('你好');
      await vi.advanceTimersByTimeAsync(60_000);
      expect(inject).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('连续消息各自注入一次', async () => {
    const { instance, inject } = await bridge();
    await instance.handleEvent(event({ message_id: 'om_a', content: 'A' }));
    await instance.handleEvent(event({ message_id: 'om_b', content: 'B' }));
    expect(inject).toHaveBeenCalledTimes(2);
    for (const call of inject.mock.calls) {
      expect(String(call[0]).match(/<lark-message /g)).toHaveLength(1);
    }
  });

  it('积压消息按创建时间升序串行投递', async () => {
    let release: (() => void) | undefined;
    let call = 0;
    const { instance, inject, store } = await bridge(ready(), true, {
      injectImpl: () => {
        call += 1;
        if (call === 1) {
          return new Promise((resolve) => {
            release = () => resolve({ sessionId: 's1', created: true });
          });
        }
        return Promise.resolve({ sessionId: 's1', created: true });
      },
    });
    const now = Date.now();
    const first = instance.handleEvent(
      event({ message_id: 'om_a', timestamp: String(now), content: 'A' }),
    );
    await vi.waitFor(() => expect(inject).toHaveBeenCalledTimes(1));
    const second = instance.handleEvent(
      event({ message_id: 'om_b', timestamp: String(now + 2_000), content: 'B' }),
    );
    const third = instance.handleEvent(
      event({ message_id: 'om_c', timestamp: String(now + 1_000), content: 'C' }),
    );
    await vi.waitFor(async () => {
      const state = await store.load();
      expect(state.seen['om_b']).toBeDefined();
      expect(state.seen['om_c']).toBeDefined();
    });
    await flushMicrotasks();
    release?.();
    await Promise.all([first, second, third]);
    expect(inject).toHaveBeenCalledTimes(3);
    const order = inject.mock.calls.map(
      (call) => /message_id="(om_[a-z])"/.exec(String(call[0]))?.[1],
    );
    expect(order).toEqual(['om_a', 'om_c', 'om_b']);
  });

  it('重复消息只入队一次', async () => {
    const { instance, inject } = await bridge();
    expect(await instance.handleEvent(event({ message_id: 'om_a' }))).toBe(true);
    expect(await instance.handleEvent(event({ message_id: 'om_a' }))).toBe(false);
    expect(inject).toHaveBeenCalledTimes(1);
    expect(String(inject.mock.calls[0]?.[0]).match(/<lark-message /g)).toHaveLength(1);
  });

  it('早于监听启动的消息被过滤', async () => {
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
    expect(await instance.handleEvent(event({ message_id: 'om_old', timestamp: old }))).toBe(false);
    expect(inject).not.toHaveBeenCalled();
    const filtered = logger.warn.mock.calls
      .map((call) => String(call[0]))
      .find((line) => line.includes('filtered om_old'));
    expect(filtered).toMatch(/created=\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    expect(filtered).toMatch(/received=\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    instance.stop();
  });

  it('注入失败后记录并继续注入下一条消息', async () => {
    let fail = true;
    const { instance, inject, logger } = await bridge(ready(), true, {
      injectImpl: async () => {
        if (fail) throw new Error('workspace-unregistered');
        return { sessionId: 's1', created: true };
      },
    });
    await instance.handleEvent(event({ message_id: 'om_a' }));
    const failed = logger.warn.mock.calls
      .map((call) => String(call[0]))
      .find((line) => line.includes('failed 1 message'));
    expect(failed).toContain('om_a@');
    expect(failed).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\/\d{4}-/);
    fail = false;
    await instance.handleEvent(event({ message_id: 'om_b' }));
    expect(inject).toHaveBeenCalledTimes(2);
  });

  it('停止时清空待投递队列', async () => {
    let release: (() => void) | undefined;
    let call = 0;
    const { instance, inject, logger, store } = await bridge(ready(), true, {
      injectImpl: () => {
        call += 1;
        if (call === 1) {
          return new Promise((resolve) => {
            release = () => resolve({ sessionId: 's1', created: true });
          });
        }
        return Promise.resolve({ sessionId: 's1', created: true });
      },
    });
    const first = instance.handleEvent(event({ message_id: 'om_a' }));
    await vi.waitFor(() => expect(inject).toHaveBeenCalledTimes(1));
    const second = instance.handleEvent(event({ message_id: 'om_b' }));
    await vi.waitFor(async () => {
      const state = await store.load();
      expect(state.seen['om_b']).toBeDefined();
    });
    await flushMicrotasks();
    instance.stop();
    release?.();
    await Promise.all([first, second]);
    expect(inject).toHaveBeenCalledTimes(1);
    const dropped = logger.warn.mock.calls
      .map((call) => String(call[0]))
      .find((line) => line.includes('dropped 1 queued message'));
    expect(dropped).toContain('om_b@');
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
    const { instance, inject, logger } = await bridge(ready(), false, {
      injectImpl: async () => {
        throw new Error('workspace-unregistered');
      },
    });
    expect(await instance.handleEvent(event())).toBe(true);
    expect(inject).toHaveBeenCalledTimes(1);
    expect(
      logger.warn.mock.calls.some((call) => String(call[0]).includes('failed 1 message')),
    ).toBe(true);
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
