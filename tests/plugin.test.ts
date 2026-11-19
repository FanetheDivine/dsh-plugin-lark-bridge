// 插件入口与配置测试：模块契约、严格配置、apply 接线与热重载。
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { Config, readConfig, resolveConfig } from '../src/config.ts';
import { NOTIFY_TOOL_NAME, PLUGIN_LABEL } from '../src/constants.ts';
import { apply, inject, name } from '../src/index.ts';
import { makeCtx, volatile } from './helpers.ts';

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
    expect(inject).toEqual(['tools', 'agents', 'webServer']);
    expect(typeof apply).toBe('function');
    expect(typeof Config).toBe('function');
  });
});

describe('配置', () => {
  it('默认值', () => {
    const parsed = Config({});
    expect(parsed.workspaceRoot.get()).toBe('');
    expect(parsed.sessionTitle.get()).toBe('飞书');
    expect(parsed.larkCli.get()).toBe('');
    expect(parsed.authCheckOnStartup.get()).toBe(true);
  });

  it('展开热重载引用后严格校验', () => {
    const config = {
      workspaceRoot: volatile('D:/work'),
      sessionTitle: volatile('桥'),
      larkCli: volatile(''),
      authCheckOnStartup: volatile(false),
    };
    expect(readConfig(config)).toEqual({
      workspaceRoot: 'D:/work',
      sessionTitle: '桥',
      larkCli: '',
      authCheckOnStartup: false,
    });
  });

  it('容忍并丢弃旧版本的 profile 与 ownerOpenId', () => {
    const resolved = resolveConfig({ profile: 'a b', ownerOpenId: 'abc', sessionTitle: '桥' });
    expect(resolved).toEqual(resolveConfig({ sessionTitle: '桥' }));
    expect(resolved).not.toHaveProperty('profile');
    expect(resolved).not.toHaveProperty('ownerOpenId');
  });

  it('拒绝未知键与空标题', () => {
    expect(() => resolveConfig({ bogus: 1 })).toThrow('unknown config key "bogus"');
    expect(() => resolveConfig({ sessionTitle: '  ' })).toThrow('must not be empty');
  });
});

describe('apply 接线', () => {
  it('注册通知工具与五条路由', () => {
    process.env['DSH_HOME'] = mkdtempSync(path.join(tmpdir(), 'lark-bridge-test-'));
    const { webServer, routes } = makeWebServer();
    const ctx = makeCtx({ services: { webServer } });
    apply(ctx, {
      workspaceRoot: '',
      sessionTitle: '飞书',
      larkCli: '',
      authCheckOnStartup: false,
    });
    expect(ctx._registeredTools.map((tool) => tool.name)).toEqual([NOTIFY_TOOL_NAME]);
    expect(routes.map((route) => route.path).sort()).toEqual([
      '/lark-bridge/auth/cancel',
      '/lark-bridge/auth/start',
      '/lark-bridge/check',
      '/lark-bridge/session/reset',
      '/lark-bridge/status',
    ]);
  });

  it('配置热重载读取新值并重新登记', () => {
    process.env['DSH_HOME'] = mkdtempSync(path.join(tmpdir(), 'lark-bridge-test-'));
    const { webServer } = makeWebServer();
    const ctx = makeCtx({ services: { webServer } });
    const config = {
      workspaceRoot: volatile(''),
      sessionTitle: volatile('飞书'),
      larkCli: volatile(''),
      authCheckOnStartup: volatile(false),
    };
    apply(ctx, config);
    config.sessionTitle.set('另一个标题');
    ctx._emit('loader/volatile-update');
    const infos = ctx._loggerCalls
      .filter((call) => call.level === 'info')
      .map((call) => String(call.args[0]));
    expect(infos.some((line) => line.includes('config updated'))).toBe(true);
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
