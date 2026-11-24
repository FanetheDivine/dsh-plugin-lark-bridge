// 调度全局行测试：共享服务归属当前 fiber，在场状态路由随行注册与注销。
import { describe, expect, it } from 'vitest';

import { readPresenceSwitches } from '../src/lark-super-agent/config.ts';
import { apply, Config } from '../src/lark-super-agent/index.ts';
import { PresenceStore } from '../src/lark-super-agent/presence.ts';
import { PRESENCE_PATH } from '../src/lark-super-agent/routes.ts';
import { SuperAgentService } from '../src/lark-super-agent/service.ts';
import type { Context } from '../src/types.ts';

/** 构造记录 provide、effect 与路由的最小 ctx。 */
function makeRowCtx(services: Record<string, unknown> = {}) {
  const provided: Array<[string, unknown]> = [];
  const disposers: Array<() => void> = [];
  const listeners = new Map<string, (...args: unknown[]) => unknown>();
  const ctx = {
    logger: { warn() {} },
    on(name: string, fn: (...args: unknown[]) => unknown) {
      listeners.set(name, fn);
      return () => listeners.delete(name);
    },
    effect(fn: () => unknown) {
      const disposer = fn();
      if (typeof disposer === 'function') disposers.push(disposer as () => void);
    },
    provide(name: string, value: unknown) {
      provided.push([name, value]);
      return () => undefined;
    },
    get(name: string) {
      return services[name];
    },
  } as unknown as Context;
  return {
    ctx,
    provided,
    listeners,
    dispose: () => {
      for (const fn of disposers.splice(0)) fn();
    },
  };
}

describe('lark-super-agent 全局行', () => {
  it('提供带在场状态的 larkSuperAgent', () => {
    const { ctx, provided } = makeRowCtx();
    apply(ctx);
    expect(provided).toHaveLength(1);
    expect(provided[0]?.[0]).toBe('larkSuperAgent');
    const service = provided[0]?.[1] as SuperAgentService;
    expect(service).toBeInstanceOf(SuperAgentService);
    expect(service.presence).toBeInstanceOf(PresenceStore);
    expect(service.presence.get().presence).toBe('local');
  });

  it('导出两个默认开启的开关', () => {
    expect(readPresenceSwitches(Config({}))).toEqual({
      guiInputSetsLocal: true,
      larkInputSetsRemote: true,
    });
  });

  it('有 webServer 时注册在场状态路由，卸载时注销', () => {
    const routes = new Set<string>();
    const webServer = {
      getOrigin: () => 'http://127.0.0.1:1',
      register: (route: { path: string }) => {
        routes.add(route.path);
        return () => routes.delete(route.path);
      },
    };
    const { ctx, dispose } = makeRowCtx({ webServer });
    apply(ctx);
    expect([...routes]).toEqual([PRESENCE_PATH]);
    dispose();
    expect(routes.size).toBe(0);
  });

  it('全局 pre-step 观察任一会话的输入，reject 不观察', async () => {
    const { ctx, provided, listeners } = makeRowCtx();
    apply(ctx);
    const service = provided[0]?.[1] as SuperAgentService;
    const listener = listeners.get('agent/pre-step');
    const lark = { role: 'user', content: [], source: { kind: 'lark-bridge' } };
    await listener?.({}, async () => ({ kind: 'reject', messages: [lark] }));
    expect(service.presence.get().presence).toBe('local');
    const decision = { kind: 'enter', messages: [lark] };
    expect(await listener?.({}, async () => decision)).toBe(decision);
    expect(service.presence.get().presence).toBe('remote');
  });

  it('开关读取行配置的实时值', () => {
    const { ctx, provided } = makeRowCtx();
    apply(ctx, { guiInputSetsLocal: true, larkInputSetsRemote: false });
    const service = provided[0]?.[1] as SuperAgentService;
    service.presence.observe([
      { role: 'user', content: [], source: { kind: 'lark-bridge' } },
    ] as never);
    expect(service.presence.get().presence).toBe('local');
  });
});
