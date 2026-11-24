// 工作会话模型测试：配置读取、调度创建标记，以及调度与工作子行的接入。
import { describe, expect, it, vi } from 'vitest';

import { readWorkerModel, WorkerModelStore } from '../src/lark-super-agent/worker-model.ts';
import { apply as applyDispatch } from '../src/sa-dispatch/index.ts';
import { apply as applyWorker } from '../src/sa-worker/index.ts';
import type { Context } from '../src/types.ts';
import { makeCtx, volatile } from './helpers.ts';

const SELECTION = { provider: 'deepseek', model: 'deepseek-chat', reasoningEffort: 'high' };

describe('readWorkerModel', () => {
  it('provider 与模型成对时带上 effort，并读取热重载引用', () => {
    const effort = volatile('high');
    const config = {
      workerProvider: volatile('deepseek'),
      workerModel: volatile(' deepseek-chat '),
      workerEffort: effort,
    };
    expect(readWorkerModel(config)).toEqual(SELECTION);
    effort.set('');
    expect(readWorkerModel(config)).toEqual({ provider: 'deepseek', model: 'deepseek-chat' });
  });

  it('未配置或半组配置按未配置处理，effort 不单独生效', () => {
    expect(readWorkerModel(undefined)).toBeUndefined();
    expect(readWorkerModel({ workerProvider: 'deepseek' })).toBeUndefined();
    expect(readWorkerModel({ workerModel: 'm', workerEffort: 'high' })).toBeUndefined();
  });
});

describe('WorkerModelStore', () => {
  const logger = { warn: vi.fn() };

  it('只在调度创建的调用链内交出已校验的选择，且只交一次', async () => {
    const store = new WorkerModelStore(() => SELECTION as never);
    const llm = { resolveCallConfig: vi.fn(async () => ({})) };
    expect(await store.take(llm, logger)).toBeUndefined();
    let first: unknown;
    let second: unknown;
    await store.during(async () => {
      await Promise.resolve();
      first = await store.take(llm, logger);
      second = await store.take(llm, logger);
    });
    expect(first).toEqual(SELECTION);
    expect(second).toBeUndefined();
    expect(llm.resolveCallConfig).toHaveBeenCalledTimes(1);
    expect(llm.resolveCallConfig).toHaveBeenCalledWith(SELECTION);
    expect(await store.take(llm, logger)).toBeUndefined();
  });

  it('调度创建进行中，调用链之外创建的会话取不到模型', async () => {
    const store = new WorkerModelStore(() => SELECTION as never);
    const llm = { resolveCallConfig: vi.fn(async () => ({})) };
    let release = (): void => undefined;
    let inside: unknown;
    const slow = store.during(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      inside = await store.take(llm, logger);
    });
    // 与调度创建并行，但不在它的调用链内：模拟用户手动新建。
    const outside = await store.take(llm, logger);
    expect(outside).toBeUndefined();
    expect(llm.resolveCallConfig).not.toHaveBeenCalled();
    release();
    await slow;
    expect(inside).toEqual(SELECTION);
  });

  it('并行的两次调度创建各取各的，失败的创建不留标记', async () => {
    const store = new WorkerModelStore(() => SELECTION as never);
    const llm = { resolveCallConfig: vi.fn(async () => ({})) };
    const takeInside = () =>
      store.during(async () => {
        await Promise.resolve();
        return store.take(llm, logger);
      });
    const [one, two] = await Promise.all([takeInside(), takeInside()]);
    expect(one).toEqual(SELECTION);
    expect(two).toEqual(SELECTION);
    await expect(store.during(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(await store.take(llm, logger)).toBeUndefined();
  });

  it('校验失败时回退宿主默认并记录警告', async () => {
    const warn = vi.fn();
    const store = new WorkerModelStore(() => SELECTION as never);
    const llm = {
      resolveCallConfig: vi.fn(async () => {
        throw new Error('effort high is not supported');
      }),
    };
    await store.during(async () => {
      expect(await store.take(llm, { warn })).toBeUndefined();
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('effort high is not supported'));
  });

  it('未配置时不标记；缺少 llm 服务时不应用', async () => {
    const warn = vi.fn();
    const empty = new WorkerModelStore(() => undefined);
    await empty.during(async () => {
      expect(await empty.take({ resolveCallConfig: vi.fn() }, { warn })).toBeUndefined();
    });
    const store = new WorkerModelStore(() => SELECTION as never);
    await store.during(async () => {
      expect(await store.take(undefined, { warn })).toBeUndefined();
    });
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

/** 挂载一个子行并返回其监听表。 */
function mountRow(
  apply: (ctx: Context) => void,
  workerModel: WorkerModelStore,
  extra: Record<string, unknown> = {},
  base = makeCtx(),
) {
  const injected = Object.assign(base, {
    larkSuperAgent: {
      workerModel,
      presence: { reminderFor: () => undefined },
    },
    systemPrompt: { section: () => () => true },
    ...extra,
  });
  const ctx = Object.assign(injected, {
    inject: (_deps: string[], callback: (context: unknown) => void) => {
      callback(injected);
      return () => true;
    },
  });
  apply(ctx as unknown as Context);
  return base;
}

describe('SA-调度会话 session_create 标记', () => {
  it('隐式模型的 session_create 执行期间标记，显式模型与其他工具不标记', async () => {
    const store = new WorkerModelStore(() => SELECTION as never);
    const base = mountRow(applyDispatch, store);
    const listener = base._onCallbacks.get('tools/execute')?.[0];
    if (listener === undefined) throw new Error('missing tools/execute listener');
    const llm = { resolveCallConfig: vi.fn(async () => ({})) };
    const probe = async (name: string, args: unknown) => {
      let seen: unknown;
      await listener({ name, arguments: args }, async () => {
        seen = await store.take(llm, { warn: vi.fn() });
        return { ok: true };
      });
      return seen;
    };
    expect(await probe('session_create', { workspace_id: 'w' })).toEqual(SELECTION);
    expect(await probe('session_create', { provider: 'p', model: 'm' })).toBeUndefined();
    expect(await probe('session_send', { session_id: 's' })).toBeUndefined();
  });
});

describe('SA-工作会话 agent/created', () => {
  const llm = { resolveCallConfig: vi.fn(async () => ({})) };

  /** 触发 agent/created，返回 select 的调用。 */
  async function created(source: string, mark: boolean) {
    const store = new WorkerModelStore(() => SELECTION as never);
    const base = makeCtx();
    (base as unknown as { _services: Map<string, unknown> })._services.set('llm', llm);
    mountRow(applyWorker, store, {}, base);
    const listener = base._onCallbacks.get('agent/created')?.[0];
    if (listener === undefined) throw new Error('missing agent/created listener');
    const select = vi.fn();
    const run = () => listener({ agent: { model: { select } }, source });
    if (mark) await store.during(async () => void (await run()));
    else await run();
    return select;
  }

  it('调度创建期间的新会话选择配置的模型', async () => {
    expect(await created('startup', true)).toHaveBeenCalledWith(SELECTION);
  });

  it('非调度创建、恢复与清空的会话不受影响', async () => {
    expect(await created('startup', false)).not.toHaveBeenCalled();
    expect(await created('resume', true)).not.toHaveBeenCalled();
    expect(await created('clear', true)).not.toHaveBeenCalled();
  });
});
