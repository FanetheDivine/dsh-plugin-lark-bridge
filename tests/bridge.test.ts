// 事件桥测试：过滤、去重、提醒格式化与注入。
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { AuthSnapshot } from '../src/auth.ts';
import { acceptEvent, EventBridge, type FeishuEvent, formatFeishuReminder } from '../src/bridge.ts';
import type { PluginConfig } from '../src/config.ts';
import { StateStore } from '../src/state.ts';

const CONFIG: PluginConfig = {
  workspaceRoot: 'D:/work',
  sessionTitle: '飞书',
  profile: 'dsh-lark-bridge',
  larkCli: '',
  ownerOpenId: '',
  authCheckOnStartup: true,
};

/** 就绪的鉴权快照。 */
function ready(): AuthSnapshot {
  return {
    stage: 'ready',
    ready: true,
    profile: 'dsh-lark-bridge',
    appId: 'cli_x',
    botStatus: 'ready',
    userName: '袁',
    ownerOpenId: 'ou_1',
    checkedAt: 1,
    detail: undefined,
  };
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
async function bridge(auth: AuthSnapshot = ready()) {
  const dir = await mkdtemp(path.join(tmpdir(), 'lark-bridge-events-'));
  const store = new StateStore(path.join(dir, 'state.json'));
  const inject = vi.fn(async () => ({ sessionId: 's1', created: true }));
  const logger = { info: vi.fn(), warn: vi.fn() };
  const instance = new EventBridge({
    getConfig: () => CONFIG,
    getCli: () => ({ spawn: vi.fn() }) as never,
    getAuth: () => auth,
    store,
    sessions: { inject } as never,
    logger,
  });
  return { instance, inject, logger, store };
}

describe('acceptEvent', () => {
  it('只接受目标用户的私聊', () => {
    expect(acceptEvent(event(), 'ou_1')).toBe(true);
    expect(acceptEvent(event({ chat_type: 'group' }), 'ou_1')).toBe(false);
    expect(acceptEvent(event({ sender_type: 'bot' }), 'ou_1')).toBe(false);
    expect(acceptEvent(event({ sender_id: 'ou_2' }), 'ou_1')).toBe(false);
  });
});

describe('formatFeishuReminder', () => {
  it('包含发送者、时间与正文', () => {
    const text = formatFeishuReminder(event(), '袁');
    expect(text).toContain('发送者：袁');
    expect(text).toContain('消息 ID：om_1');
    expect(text).toContain('你好');
  });

  it('无文本时使用消息类型占位', () => {
    const text = formatFeishuReminder(event({ content: '', message_type: 'image' }), '袁');
    expect(text).toContain('[image 消息]');
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
    const { instance, inject } = await bridge({ ...ready(), ready: false, stage: 'user-missing' });
    expect(await instance.handleEvent(event())).toBe(false);
    expect(inject).not.toHaveBeenCalled();
  });

  it('缺少消息标识时丢弃', async () => {
    const { instance, inject } = await bridge();
    expect(await instance.handleEvent(event({ message_id: '', id: '' }))).toBe(false);
    expect(inject).not.toHaveBeenCalled();
  });
});
