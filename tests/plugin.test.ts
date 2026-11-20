// 插件入口与配置测试：模块契约、严格配置、apply 接线与热重载。
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { LarkCli } from '../src/cli.ts';

import {
  Config,
  DEFAULT_CONFIG,
  modelSelectionOf,
  type PluginConfig,
  presetOf,
  readConfig,
  resolveConfig,
} from '../src/config.ts';
import { NOTIFY_TOOL_NAME, PLUGIN_LABEL } from '../src/constants.ts';
import { apply, inject, name } from '../src/index.ts';
import { makeCtx, volatile } from './helpers.ts';

beforeEach(() => {
  vi.spyOn(LarkCli.prototype, 'run').mockResolvedValue({ stdout: '1.0.0', stderr: '', code: 0 });
  vi.spyOn(LarkCli.prototype, 'json').mockResolvedValue({
    appId: 'cli_x',
    identities: {
      bot: { status: 'ready' },
      user: { status: 'ready', openId: 'ou_1', userName: '测试用户' },
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** 最小 WebServer 假实现：记录注册的路由。 */
function makeWebServer() {
  const routes: Array<{ path: string }> = [];
  const webServer = {
    getOrigin: () => 'http://127.0.0.1:1234',
    register: (route: { path: string }) => {
      routes.push(route);
      return () => undefined;
    },
  };
  return { webServer, routes };
}

describe('模块契约', () => {
  it('导出 name / inject / apply / Config', () => {
    expect(name).toBe(PLUGIN_LABEL);
    expect(inject).toEqual(['tools', 'agents', 'webServer', 'workspaceRegistry']);
    expect(typeof apply).toBe('function');
    expect(typeof Config).toBe('function');
  });
});

describe('配置', () => {
  it('包含工作区与新建会话默认值', () => {
    const parsed = Config({});
    expectTypeOf<PluginConfig>().toEqualTypeOf<{
      workspaceRoot: string;
      sessionProvider: string;
      sessionModel: string;
      sessionEffort: string;
      sessionPreset: string;
    }>();
    expect(parsed.workspaceRoot.get()).toBe('');
    expect(parsed.sessionPreset.get()).toBe('');
    expect(Object.keys(parsed)).toEqual([
      'workspaceRoot',
      'sessionProvider',
      'sessionModel',
      'sessionEffort',
      'sessionPreset',
    ]);
    expect(DEFAULT_CONFIG).toEqual({
      workspaceRoot: '',
      sessionProvider: '',
      sessionModel: '',
      sessionEffort: '',
      sessionPreset: '',
    });
  });

  it('读取新建会话的模型与预设配置', () => {
    const resolved = resolveConfig({
      sessionProvider: 'deepseek',
      sessionModel: 'deepseek-chat',
      sessionEffort: 'high',
      sessionPreset: 'bridge',
    });
    expect(modelSelectionOf(resolved)).toEqual({
      provider: 'deepseek',
      model: 'deepseek-chat',
      reasoningEffort: 'high',
    });
    expect(presetOf(resolved)).toBe('bridge');
  });

  it('空白与半组模型配置按未配置处理', () => {
    const blank = resolveConfig({ sessionProvider: '  ', sessionModel: '  ' });
    expect(modelSelectionOf(blank)).toBeUndefined();
    expect(presetOf(resolveConfig({ sessionPreset: '  ' }))).toBe('');

    const half = resolveConfig({ sessionProvider: 'deepseek', sessionEffort: 'high' });
    expect(modelSelectionOf(half)).toBeUndefined();
  });

  it('模型配置拒绝非字符串', () => {
    expect(() => resolveConfig({ sessionProvider: 1 })).toThrow(
      'config sessionProvider must be a string',
    );
  });

  it('展开热重载引用并归一化工作区路径', () => {
    const resolved = readConfig({ workspaceRoot: volatile('C:\\work\\demo') });
    expect(resolved).toEqual({ ...DEFAULT_CONFIG, workspaceRoot: '/c/work/demo' });
    expect(resolveConfig({ workspaceRoot: 'C:\\work\\demo' })).toEqual(resolved);
  });

  it('容忍并丢弃全部旧配置键', () => {
    const legacy = {
      profile: 'a b',
      ownerOpenId: 'abc',
      larkCli: 'C:/legacy/lark-cli.js',
      sessionTitle: '  ',
      authCheckOnStartup: false,
    };
    const resolved = resolveConfig(legacy);
    expect(resolved).toEqual(DEFAULT_CONFIG);
    expect(resolved).not.toHaveProperty('profile');
    expect(resolved).not.toHaveProperty('ownerOpenId');
    expect(resolved).not.toHaveProperty('larkCli');
    expect(resolved).not.toHaveProperty('sessionTitle');
    expect(resolved).not.toHaveProperty('authCheckOnStartup');

    const read = readConfig({
      ...legacy,
      larkCli: volatile('C:/legacy/other-lark-cli.js'),
      sessionTitle: volatile('  '),
      authCheckOnStartup: volatile(false),
    });
    expect(read).toEqual(resolved);
  });

  it('拒绝未知键', () => {
    expect(() => resolveConfig({ bogus: 1 })).toThrow('unknown config key "bogus"');
  });
});

describe('apply 接线', () => {
  it('注册通知工具与两条路由', () => {
    process.env['DSH_HOME'] = mkdtempSync(path.join(tmpdir(), 'lark-bridge-test-'));
    const { webServer, routes } = makeWebServer();
    const ctx = makeCtx({ services: { webServer } });
    apply(ctx, { workspaceRoot: '' });
    expect(ctx._registeredTools.map((tool) => tool.name)).toEqual([NOTIFY_TOOL_NAME]);
    expect(routes.map((route) => route.path).sort()).toEqual([
      '/lark-bridge/check',
      '/lark-bridge/status',
    ]);
  });

  it('旧 authCheckOnStartup:false 仍执行启动完整检测', async () => {
    process.env['DSH_HOME'] = mkdtempSync(path.join(tmpdir(), 'lark-bridge-test-'));
    const { webServer } = makeWebServer();
    const ctx = makeCtx({ services: { webServer } });
    apply(ctx, { authCheckOnStartup: false });

    await vi.waitFor(() => {
      expect(LarkCli.prototype.run).toHaveBeenCalledWith(['--version'], {
        timeoutMs: 60_000,
        allowFailure: true,
      });
      expect(LarkCli.prototype.json).toHaveBeenCalledWith(
        ['auth', 'status', '--json', '--verify'],
        { timeoutMs: 60_000 },
      );
    });
  });

  it('配置热重载读取新值并重新登记', () => {
    process.env['DSH_HOME'] = mkdtempSync(path.join(tmpdir(), 'lark-bridge-test-'));
    const { webServer } = makeWebServer();
    const ctx = makeCtx({ services: { webServer } });
    const config = { workspaceRoot: volatile('C:\\work\\demo') };
    apply(ctx, config);
    config.workspaceRoot.set('C:\\work\\demo\\next');
    ctx._emit('loader/volatile-update');
    const infos = ctx._loggerCalls
      .filter((call) => call.level === 'info')
      .map((call) => String(call.args[0]));
    expect(infos.some((line) => line.includes('config updated'))).toBe(true);
  });

  it('注册提醒补注监听', () => {
    process.env['DSH_HOME'] = mkdtempSync(path.join(tmpdir(), 'lark-bridge-test-'));
    const ctx = makeCtx();
    apply(ctx, { workspaceRoot: '' });
    expect(ctx._onCallbacks.has('agent/pre-step')).toBe(true);
  });

  it('卸载时注销工具并停止监听', () => {
    process.env['DSH_HOME'] = mkdtempSync(path.join(tmpdir(), 'lark-bridge-test-'));
    const { webServer } = makeWebServer();
    const ctx = makeCtx({ services: { webServer } });
    apply(ctx, { authCheckOnStartup: false });
    expect(ctx._activeTools.size).toBe(1);
    ctx._dispose();
    expect(ctx._activeTools.size).toBe(0);
  });
});

describe('未提供 webServer', () => {
  it('仍注册工具并记录警告', () => {
    process.env['DSH_HOME'] = mkdtempSync(path.join(tmpdir(), 'lark-bridge-test-'));
    const ctx = makeCtx();
    apply(ctx, { authCheckOnStartup: false });
    expect(ctx._registeredTools.map((tool) => tool.name)).toEqual([NOTIFY_TOOL_NAME]);
    expect(
      ctx._loggerCalls.some(
        (call) => call.level === 'warn' && String(call.args[0]).includes('webServer'),
      ),
    ).toBe(true);
  });
});
