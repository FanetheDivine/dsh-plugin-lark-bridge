// 调度全局行测试：共享服务归属当前 fiber。
import { describe, expect, it } from 'vitest';

import { apply } from '../src/lark-super-agent/index.ts';
import { SuperAgentService } from '../src/lark-super-agent/service.ts';
import type { Context } from '../src/types.ts';

describe('lark-super-agent 全局行', () => {
  it('提供 larkSuperAgent，不注册路由', () => {
    const provided: Array<[string, unknown]> = [];
    const injected: string[][] = [];
    const ctx = {
      effect(fn: () => unknown) {
        fn();
      },
      provide(name: string, value: unknown) {
        provided.push([name, value]);
        return () => undefined;
      },
      inject(deps: string[]) {
        injected.push(deps);
      },
    } as unknown as Context;
    apply(ctx);
    expect(provided).toHaveLength(1);
    expect(provided[0]?.[0]).toBe('larkSuperAgent');
    expect(provided[0]?.[1]).toBeInstanceOf(SuperAgentService);
    expect(injected).toEqual([]);
  });
});
