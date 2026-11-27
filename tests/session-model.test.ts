// SA-调度会话 session_model 测试：目标会话解析、参数与校验失败，以及选择写入。
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools';
import { ToolArgsError } from '@deepseek-ai/dsh-tools';
import { describe, expect, it, vi } from 'vitest';

import { buildSessionModelTool } from '../src/sa-dispatch/session-model.ts';

/** 构造一组可观察的依赖。 */
function makeDeps(
  options: {
    archived?: readonly string[];
    llm?: { resolveCallConfig: ReturnType<typeof vi.fn> } | null;
    resolveAgent?: ReturnType<typeof vi.fn>;
    previous?: { provider: string; model: string; reasoningEffort?: string } | undefined;
  } = {},
) {
  const select = vi.fn();
  const current = vi.fn(() => options.previous);
  const agent = { model: { current, select } };
  const resolveAgent = options.resolveAgent ?? vi.fn(async () => ({ agent }));
  const llm =
    options.llm === null
      ? undefined
      : (options.llm ?? { resolveCallConfig: vi.fn(async () => ({})) });
  const tool = buildSessionModelTool({
    sessionController: { resolveAgent } as never,
    llm: llm as never,
    archivedSessionIds: () => options.archived ?? [],
  });
  return { tool, select, current, resolveAgent, llm };
}

/** 执行工具；调用方会话固定。 */
function run(tool: ToolDefinition, args: Record<string, unknown>, callerId = 'session-caller') {
  const exec = {
    signal: new AbortController().signal,
    agent: { session: { header: { id: callerId } } },
  } as unknown as ToolRunContext;
  return tool.execute(args as never, exec);
}

describe('session_model', () => {
  it('把显式路由写进目标会话并回报生效选择', async () => {
    const { tool, select, resolveAgent } = makeDeps({ previous: { provider: 'm', model: 'old' } });

    const result = await run(tool, {
      session_id: ' session-task ',
      provider: ' mock ',
      model: ' mock-next ',
      effort: 'high',
    });

    expect(resolveAgent).toHaveBeenCalledWith('session-task');
    expect(select).toHaveBeenCalledWith({
      provider: 'mock',
      model: 'mock-next',
      reasoningEffort: 'high',
    });
    expect(result).toEqual({
      sessionId: 'session-task',
      provider: 'mock',
      model: 'mock-next',
      effort: 'high',
      previous: { provider: 'm', model: 'old' },
      archived: false,
    });
  });

  it('省略 session_id 时切换调用方自己', async () => {
    const { tool, select, resolveAgent } = makeDeps();

    const result = await run(tool, { provider: 'mock', model: 'mock-next' });

    expect(resolveAgent).toHaveBeenCalledWith('session-caller');
    expect(select).toHaveBeenCalledWith({ provider: 'mock', model: 'mock-next' });
    expect(result).toMatchObject({ sessionId: 'session-caller' });
    expect(result).not.toHaveProperty('effort');
    expect(result).not.toHaveProperty('previous');
  });

  it('provider 或 model 为空时按参数错误拒绝', async () => {
    const { tool, select, resolveAgent } = makeDeps();

    await expect(run(tool, { provider: 'mock', model: '  ' })).rejects.toBeInstanceOf(
      ToolArgsError,
    );
    expect(select).not.toHaveBeenCalled();
    expect(resolveAgent).not.toHaveBeenCalled();
  });

  it('宿主校验失败时不写选择', async () => {
    const { tool, select } = makeDeps({
      llm: {
        resolveCallConfig: vi.fn(async () => {
          throw new Error('provider "mock" model "nope" does not support reasoning effort "max"');
        }),
      },
    });

    await expect(run(tool, { provider: 'mock', model: 'nope', effort: 'max' })).rejects.toThrow(
      'Invalid model selection:',
    );
    expect(select).not.toHaveBeenCalled();
  });

  it('llm 服务缺失时失败', async () => {
    const { tool, select } = makeDeps({ llm: null });

    await expect(run(tool, { provider: 'mock', model: 'next' })).rejects.toThrow(
      'llm service is not mounted',
    );
    expect(select).not.toHaveBeenCalled();
  });

  it('会话不存在时透传宿主错误且不写选择', async () => {
    const failure = Object.assign(new Error('session "gone" not found'), {
      code: 'session/not-found',
    });
    const { tool, select } = makeDeps({
      resolveAgent: vi.fn(async () => ({ error: failure })),
    });

    await expect(run(tool, { session_id: 'gone', provider: 'mock', model: 'next' })).rejects.toBe(
      failure,
    );
    expect(select).not.toHaveBeenCalled();
  });

  it('目标会话已归档时结果标明归档状态', async () => {
    const { tool } = makeDeps({ archived: ['session-task'] });

    const result = await run(tool, {
      session_id: 'session-task',
      provider: 'mock',
      model: 'next',
    });

    expect(result).toMatchObject({ sessionId: 'session-task', archived: true });
  });

  it('空 effort 视为未指定', async () => {
    const { tool, select } = makeDeps();

    const result = await run(tool, { provider: 'mock', model: 'next', effort: '  ' });

    expect(select).toHaveBeenCalledWith({ provider: 'mock', model: 'next' });
    expect(result).not.toHaveProperty('effort');
  });
});
