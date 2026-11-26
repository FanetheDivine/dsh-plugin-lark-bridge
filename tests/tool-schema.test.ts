// 工具声明回归测试：三行插件注册的工具，其参数声明都必须能被宿主无损克隆。
import type { ToolDefinition } from '@deepseek-ai/dsh-tools';
import { describe, expect, it, vi } from 'vitest';

import { apply as applyMain } from '../src/index.ts';
import type { LarkSuperAgentService } from '../src/lark-super-agent/api.ts';
import { applyManagedSessions } from '../src/lark-super-agent/managed/index.ts';
import { PresenceStore } from '../src/lark-super-agent/presence.ts';
import { registerDispatchTools } from '../src/sa-dispatch/tools.ts';
import type { Context } from '../src/types.ts';
import { makeCtx } from './helpers.ts';
import { assertLosslessJson } from './support/lossless-json.ts';

/** 一行插件注册的工具，带行名便于失败定位。 */
interface Row {
  readonly label: string;
  readonly tools: readonly ToolDefinition[];
}

/** 共享服务桩：只填写注册路径会读取的字段。 */
function makeService(): LarkSuperAgentService {
  return {
    presence: new PresenceStore({
      switches: () => ({ guiInputSetsLocal: true, larkInputSetsRemote: true }),
    }),
    taskModel: () => undefined,
    taskPreset: () => '',
    bridgeSessionId: vi.fn(),
    managedTask: vi.fn(),
    createTask: vi.fn(),
    setManagedSessionListener: vi.fn(),
    assertDispatchable: vi.fn(),
    manageSession: vi.fn(),
    updateTask: vi.fn(),
    endTask: vi.fn(),
    pruneTasks: vi.fn(),
    setWorkspaceNote: vi.fn(),
    removeWorkspaceNote: vi.fn(),
    sendReport: vi.fn(),
    notifyFailure: vi.fn(),
    notifyArchived: vi.fn(),
  } satisfies LarkSuperAgentService;
}

/** 主行注册的工具。 */
function mainRowTools(): ToolDefinition[] {
  const webServer = { getOrigin: () => 'http://127.0.0.1:1234', register: () => () => undefined };
  const ctx = makeCtx({ services: { webServer } });
  applyMain(ctx, { workspaceRoot: '' });
  return ctx._registeredTools as unknown as ToolDefinition[];
}

/** 调度会话行注册的工具。 */
function dispatchRowTools(): ToolDefinition[] {
  const ctx = makeCtx({ services: { larkSuperAgent: makeService() } });
  registerDispatchTools(ctx as unknown as Context & { larkSuperAgent: LarkSuperAgentService });
  return ctx._registeredTools as unknown as ToolDefinition[];
}

/** 全局行注册的被管理会话工具。 */
function managedRowTools(): ToolDefinition[] {
  const ctx = makeCtx();
  applyManagedSessions(ctx as unknown as Context, makeService(), async () => null);
  return ctx._registeredTools as unknown as ToolDefinition[];
}

/** 三行插件注册的全部工具。 */
function rows(): Row[] {
  return [
    { label: 'main', tools: mainRowTools() },
    { label: 'sa-dispatch', tools: dispatchRowTools() },
    { label: 'lark-super-agent', tools: managedRowTools() },
  ];
}

describe('工具参数声明', () => {
  it('三行插件都有工具注册', () => {
    for (const row of rows()) expect(row.tools.length).toBeGreaterThan(0);
  });

  it('全部声明通过宿主等价的无损 JSON 校验', () => {
    for (const row of rows()) {
      for (const tool of row.tools) {
        expect(
          () => assertLosslessJson(tool.parameters, `${row.label}.${tool.name}.parameters`),
          `${row.label}.${tool.name}`,
        ).not.toThrow();
      }
    }
  });

  it('同一批声明连续校验 10 次结果一致', () => {
    const tools = rows().flatMap((row) => row.tools);
    const first = tools.map((tool) => assertLosslessJson(tool.parameters, tool.name));
    for (let round = 0; round < 10; round++) {
      const next = tools.map((tool) => assertLosslessJson(tool.parameters, tool.name));
      expect(next).toEqual(first);
    }
  });
});
