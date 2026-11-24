// 全局在场状态测试：初始值、手动切换、按开关与来源自动更新。
import type { UserMessage } from '@deepseek-ai/dsh-llm';
import { describe, expect, it } from 'vitest';

import { readPresenceSwitches } from '../src/lark-super-agent/config.ts';
import { PresenceStore, type PresenceSwitches } from '../src/lark-super-agent/presence.ts';
import { volatile } from './helpers.ts';

/** 构造带来源的用户消息。 */
function sourced(source: Record<string, unknown>): UserMessage {
  return { id: Math.random().toString(36), role: 'user', content: [], source } as never;
}

const gui = (): UserMessage => sourced({ kind: 'user' });
const lark = (): UserMessage => sourced({ kind: 'lark-bridge' });

/** 构造可变开关与时钟的仓库。 */
function setup(initial: Partial<PresenceSwitches> = {}) {
  const switches = { guiInputSetsLocal: true, larkInputSetsRemote: true, ...initial };
  let time = 100;
  const store = new PresenceStore({ switches: () => switches, now: () => time });
  return {
    store,
    switches,
    tick: () => {
      time += 1;
    },
  };
}

describe('PresenceStore', () => {
  it('初始为在电脑旁', () => {
    const { store } = setup();
    expect(store.get()).toEqual({ presence: 'local', updatedAt: 100 });
  });

  it('手动切换写入状态与时间并通知订阅者', () => {
    const { store, tick } = setup();
    const seen: string[] = [];
    store.subscribe((snapshot) => seen.push(snapshot.presence));
    tick();
    expect(store.set('remote')).toEqual({ presence: 'remote', updatedAt: 101 });
    expect(seen).toEqual(['remote']);
  });

  it('飞书输入切到离开，GUI 输入切回在电脑旁', () => {
    const { store } = setup();
    expect(store.observe([lark()]).presence).toBe('remote');
    expect(store.observe([gui()]).presence).toBe('local');
  });

  it('桥接提醒与其他来源不改变状态', () => {
    const { store } = setup();
    store.observe([
      sourced({ kind: 'lark-bridge', reminder: true }),
      sourced({ kind: 'sa-presence', presence: 'remote' }),
      sourced({ kind: 'dsh-plugin-meta-tools' }),
    ]);
    expect(store.get().presence).toBe('local');
  });

  it('同批以最后一条可判定消息为准', () => {
    const { store } = setup();
    expect(store.observe([gui(), lark()]).presence).toBe('remote');
    expect(store.observe([lark(), gui()]).presence).toBe('local');
  });

  it('开关关闭时对应来源不改变状态', () => {
    const { store, switches } = setup({ larkInputSetsRemote: false });
    expect(store.observe([lark()]).presence).toBe('local');
    store.set('remote');
    switches.guiInputSetsLocal = false;
    expect(store.observe([gui()]).presence).toBe('remote');
  });

  it('同一消息对象只生效一次，手动切换之后不被重复观察覆盖', () => {
    const { store } = setup();
    const message = gui();
    store.observe([message]);
    store.set('remote');
    expect(store.observe([message]).presence).toBe('remote');
  });

  it('状态未变时不更新时间', () => {
    const { store, tick } = setup();
    tick();
    expect(store.observe([gui()]).updatedAt).toBe(100);
  });
});

describe('readPresenceSwitches', () => {
  it('读取热重载引用的实时值', () => {
    const gui = volatile(true);
    const lark = volatile(false);
    const config = { guiInputSetsLocal: gui, larkInputSetsRemote: lark };
    expect(readPresenceSwitches(config)).toEqual({
      guiInputSetsLocal: true,
      larkInputSetsRemote: false,
    });
    gui.set(false);
    expect(readPresenceSwitches(config).guiInputSetsLocal).toBe(false);
  });

  it('缺省与非布尔值按开启处理', () => {
    expect(readPresenceSwitches(undefined)).toEqual({
      guiInputSetsLocal: true,
      larkInputSetsRemote: true,
    });
    expect(readPresenceSwitches({ guiInputSetsLocal: 'no' }).guiInputSetsLocal).toBe(true);
  });
});
