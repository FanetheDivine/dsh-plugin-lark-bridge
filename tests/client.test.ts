// @vitest-environment jsdom
// 前端测试：入口接线、字典、安全连接状态展示与共享状态控制器。
import type {} from '@deepseek-ai/dsh-client-locale/client';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import type {} from '@deepseek-ai/dsh-client-ui-layout/client';
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/src/client/directory.ts';
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-settings/client';
import type { GlobalStandardProps, TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

// 官方模型选择器依赖浏览器快照，静态渲染时替换为最小桩。
vi.mock('@deepseek-ai/dsh-client-ui-model-selection/src/client/ModelSelect.tsx', async () => {
  const { createElement } = await import('react');
  return {
    ModelSelect: (props: { locked: boolean; available: boolean }) =>
      createElement('div', {
        'data-dsh-lark-model-select': '',
        'data-locked': String(props.locked),
        'data-available': String(props.available),
      }),
  };
});

import type { ApiResult, BridgeStatus } from '../src/client/api.ts';
import {
  AuthOverlay,
  AuthOverlayContent,
  type AuthOverlayProps,
  getAuthOverlaySignature,
  INITIAL_AUTH_OVERLAY_STATE,
  reduceAuthOverlayState,
} from '../src/client/auth-overlay.tsx';
import { AuthPanelStatus } from '../src/client/auth-panel.tsx';
import {
  type ConfigFormState,
  type ConfigPageInjected,
  PluginConfigForm,
  ROW_ID,
  ROW_KEY,
} from '../src/client/config-form.ts';
import {
  ConfigPage,
  type ConfigPageProps,
  WorkspaceSelect,
  workspaceOptions,
} from '../src/client/config-page.tsx';
import * as clientEntry from '../src/client/index.ts';
import { en, NS, zh } from '../src/client/locales.ts';
import type { ModelDefaultsInjected } from '../src/client/model-defaults.ts';
import type { PresetDefaultsInjected, PresetDefaultsState } from '../src/client/preset-defaults.ts';
import { currentText, menuItems, PresetSelect } from '../src/client/preset-select.tsx';
import { StatusController } from '../src/client/status-controller.ts';
import type { ConnectionState } from '../src/types.ts';
import {
  type ClientServiceName,
  makeClientCtx,
  makeConfigFormScope,
  makeUseWorkspaces,
  type WorkspaceViewInput,
} from './helpers.ts';

const { apply } = clientEntry;
const ALL_SERVICES: ClientServiceName[] = [
  'slots',
  'locale',
  'configForms',
  'remote',
  'remote.session',
];
const CLI_COMMAND = 'npm install -g @larksuite/cli@latest';
const BOT_COMMAND = 'lark-cli config init';
const USER_COMMAND = 'lark-cli auth login --scope auth:user.id:read';

/** 用字典构造翻译函数。 */
function translate(dict: Record<string, string>): TranslateNS<typeof NS> {
  return (key, params) =>
    (dict[key] ?? key).replace(/\{(\w+)\}/g, (_match, name: string) =>
      String(params?.[name] ?? ''),
    );
}

/** 构造只含浏览器安全字段的连接状态。 */
function statusFor(states: Partial<Pick<BridgeStatus, 'cli' | 'bot' | 'user'>> = {}): BridgeStatus {
  const cli = states.cli ?? 'connected';
  const bot = states.bot ?? 'connected';
  const user = states.user ?? 'connected';
  return {
    cli,
    bot,
    user,
    ready: cli === 'connected' && bot === 'connected' && user === 'connected',
    checkedAt: 1,
  };
}

/** 渲染连接状态面板。 */
function renderAuthPanel(status: BridgeStatus | undefined, busy = false): string {
  return renderToStaticMarkup(
    createElement(AuthPanelStatus, {
      t: translate(zh),
      status,
      busy,
      onCheck: vi.fn(),
    }),
  );
}

/** 构造可直接渲染的工作区选择器。 */
function renderWorkspaceSelect(
  items: readonly WorkspaceViewInput[],
  value = '',
  disabled = false,
): string {
  return renderToStaticMarkup(
    createElement(WorkspaceSelect, {
      t: translate(zh),
      useWorkspaces: makeUseWorkspaces(items),
      value,
      disabled,
      onChange: vi.fn(),
    }),
  );
}

/** 构造配置表单的纯展示状态。 */
function formState(overrides: Partial<ConfigFormState> = {}): ConfigFormState {
  return {
    available: true,
    writable: true,
    dirty: false,
    invalid: false,
    saving: false,
    failed: false,
    workspaceRoot: { text: '/c/work/demo/One', overridden: true, invalid: false },
    sessionProvider: { text: '', overridden: false, invalid: false },
    sessionModel: { text: '', overridden: false, invalid: false },
    sessionEffort: { text: '', overridden: false, invalid: false },
    sessionPreset: { text: '', overridden: false, invalid: false },
    ...overrides,
  };
}

/** 渲染配置页时的模型目录注入桩。 */
function modelDefaultsStub(): ModelDefaultsInjected {
  const directory = createSnapshotStore<ModelDirectoryState>({
    current: null,
    routable: null,
    groups: [],
    failures: [],
    status: 'ready',
    pending: null,
    error: null,
  });
  return {
    directory,
    load: () => undefined,
    select: async () => ({ ok: true, value: undefined }),
    t: ((key: string) => key) as never,
    resolveText: (text) => String(text),
  };
}

/** 渲染配置页时的预设名册注入桩。 */
function presetDefaultsStub(): PresetDefaultsInjected {
  const store = createSnapshotStore<PresetDefaultsState>({
    status: 'ready',
    error: null,
    rows: [{ id: 'bridge', name: '桥接' }],
    current: '',
  });
  return { hooks: { presetDefaults: store }, load: () => undefined, select: () => undefined };
}

/** 渲染完整配置页。 */
function renderConfigPage(): string {
  const fake = makeConfigFormScope({
    value: {
      workspaceRoot: '/c/work/demo/One',
      sessionProvider: '',
      sessionModel: '',
      sessionEffort: '',
      sessionPreset: '',
    },
    base: {
      workspaceRoot: '',
      sessionProvider: '',
      sessionModel: '',
      sessionEffort: '',
      sessionPreset: '',
    },
  });
  const form = new PluginConfigForm(fake.scope);
  const injected = form.inject();
  const controller = new StatusController({ autoStart: false });
  const useConfigForm = <S>(selector: (state: ConfigFormState) => S): S =>
    selector(injected.hooks.configForm.getSnapshot());
  const html = renderToStaticMarkup(
    createElement(ConfigPage, {
      t: translate(zh),
      view: 'page',
      useWorkspaces: makeUseWorkspaces([
        { workspaceId: 'one', path: 'C:\\work\\demo\\One', title: '项目一' },
      ]),
      useWorkspaceAccess: () => true,
      useConfigForm,
      edit: injected.edit,
      save: injected.save,
      discard: injected.discard,
      resetField: injected.resetField,
      controller,
      modelDefaults: modelDefaultsStub(),
      presetDefaults: presetDefaultsStub(),
    } as ConfigPageProps),
  );
  controller.dispose();
  form.dispose();
  return html;
}

/** 渲染不依赖 Portal 与浏览器效果的弹窗内容。 */
function renderAuthOverlayContent(form: ConfigFormState): string {
  const controller = new StatusController({ autoStart: false });
  const html = renderToStaticMarkup(
    createElement(AuthOverlayContent, {
      t: translate(zh),
      controller,
      useWorkspaces: makeUseWorkspaces([
        { workspaceId: 'one', path: 'C:\\work\\demo\\One', title: '项目一' },
      ]),
      form,
      onEdit: vi.fn(),
      onSave: vi.fn(),
      onClose: vi.fn(),
    }),
  );
  controller.dispose();
  return html;
}

/** 构造成功的路由结果。 */
function ok(data: BridgeStatus): ApiResult<BridgeStatus> {
  return { ok: true, data };
}

/** 构造可手动完成的异步结果。 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

/** 等待路由结果与控制器状态更新。 */
async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('前端入口', () => {
  it('声明客户端必需服务，字典与配置页分两组加载', () => {
    expect(clientEntry.inject).toEqual([
      'slots',
      'locale',
      'configForms',
      'remote',
      'remote.session',
    ]);
    const ctx = makeClientCtx();
    apply(ctx);
    expect(ctx._injectGroups).toEqual([
      ['locale'],
      ['slots', 'locale', 'configForms', 'remote', 'remote.session'],
      ['remote.agentPresets'],
    ]);
  });

  it('注册双语字典、全局鉴权弹窗与面板配置页', () => {
    const ctx = makeClientCtx();
    apply(ctx);

    expect(ctx._localeRegistrations.map((entry) => entry.ns)).toEqual([NS]);
    expect(Object.keys(ctx._localeRegistrations[0]?.dicts ?? {}).sort()).toEqual(['en', 'zh']);
    expect(ctx._slotInjections).toEqual(['shell.overlay', 'plugins.row.config']);
    expect(ctx._slotRegistrations[0]?.options).toMatchObject({
      name: 'shell.overlay',
      id: 'lark-bridge-auth',
      order: 20,
      locale: NS,
    });
    expect(ctx._slotRegistrations[0]?.component).toBe(AuthOverlay);
    expect(ctx._slotRegistrations[1]?.options).toMatchObject({
      name: 'plugins.row.config',
      key: ROW_KEY,
      locale: NS,
    });
    expect(ctx._slotRegistrations[1]?.component).toBe(ConfigPage);
    expect(ctx._configFormRequests).toEqual([ROW_ID]);
    expect(ROW_KEY).toBe(`${ROW_ID}#${ROW_ID}`);

    type SharedSlotInjected = ConfigPageInjected & {
      readonly controller: StatusController;
      readonly openSettings?: () => void;
      readonly modelDefaults: ModelDefaultsInjected;
      readonly presetDefaults: PresetDefaultsInjected;
    };
    const overlayInject = ctx._slotRegistrations[0]?.options.inject as
      | (() => SharedSlotInjected)
      | undefined;
    const configInject = ctx._slotRegistrations[1]?.options.inject as
      | (() => SharedSlotInjected)
      | undefined;
    const overlay = overlayInject?.();
    const config = configInject?.();
    expect(overlay?.hooks.configForm).toBe(config?.hooks.configForm);
    expect(overlay?.controller).toBe(config?.controller);
  });

  it('卸载时释放配置表单的订阅', () => {
    const ctx = makeClientCtx();
    apply(ctx);
    const scope = ctx._configFormScopes[0];
    expect(scope?.subscriberCount()).toBe(1);
    ctx._dispose();
    expect(scope?.subscriberCount()).toBe(0);
  });
});

/** 某组服务可用时应注册的内容。 */
function expectedRegistrations(services: ClientServiceName[]) {
  const has = (...names: ClientServiceName[]) => names.every((name) => services.includes(name));
  return {
    dictionary: has('locale'),
    overlay: has('slots', 'locale', 'configForms', 'remote', 'remote.session'),
    configPage: has('slots', 'locale', 'configForms', 'remote', 'remote.session'),
  };
}

/** 当前生效的注册内容。 */
function activeRegistrations(ctx: ReturnType<typeof makeClientCtx>) {
  const slotNames = [...ctx._activeSlots].map((entry) => entry.options.name);
  return {
    dictionary: ctx._activeLocales.size === 1,
    overlay: slotNames.includes('shell.overlay'),
    configPage: slotNames.includes('plugins.row.config'),
  };
}

/** 每个服务各有或无的全部组合。 */
const COMBINATIONS: ClientServiceName[][] = Array.from(
  { length: 2 ** ALL_SERVICES.length },
  (_, mask) => ALL_SERVICES.filter((_name, index) => (mask >> index) & 1),
);

describe('前端服务可选', () => {
  it.each(COMBINATIONS.map((services) => [services]))(
    '服务 %j 可用时启用成功，注册内容与可用性一一对应',
    (services) => {
      const ctx = makeClientCtx({ services });
      expect(() => apply(ctx)).not.toThrow();
      expect(activeRegistrations(ctx)).toEqual(expectedRegistrations(services));
    },
  );

  it('configForms 缺失时不请求配置表单', () => {
    const ctx = makeClientCtx({ services: ['slots', 'locale'] });
    apply(ctx);
    expect(ctx._configFormRequests).toEqual([]);
  });

  it('configForms 晚就绪后配置页自动注册', () => {
    const ctx = makeClientCtx({ services: ['slots', 'locale'] });
    apply(ctx);
    expect(activeRegistrations(ctx).configPage).toBe(false);
    ctx._grant('configForms', 'remote', 'remote.session');
    expect(activeRegistrations(ctx)).toEqual({ dictionary: true, overlay: true, configPage: true });
    expect(ctx._configFormRequests).toEqual([ROW_ID]);
  });

  it('服务撤掉后只清理依赖它的功能', () => {
    const ctx = makeClientCtx();
    apply(ctx);
    const scope = ctx._configFormScopes[0];
    ctx._revoke('configForms');
    expect(activeRegistrations(ctx)).toEqual({
      dictionary: true,
      overlay: false,
      configPage: false,
    });
    expect(scope?.subscriberCount()).toBe(0);
    ctx._grant('configForms');
    expect(ctx._activeSlots.size).toBe(2);
    expect(ctx._activeLocales.size).toBe(1);
  });

  it('locale 撤掉后三项功能都被清理', () => {
    const ctx = makeClientCtx();
    apply(ctx);
    ctx._revoke('locale');
    expect(activeRegistrations(ctx)).toEqual({
      dictionary: false,
      overlay: false,
      configPage: false,
    });
  });
});

describe('连接状态展示', () => {
  it('BridgeStatus 只暴露三个连接状态、ready 与 checkedAt', () => {
    expectTypeOf<BridgeStatus>().toEqualTypeOf<{
      readonly cli: ConnectionState;
      readonly bot: ConnectionState;
      readonly user: ConnectionState;
      readonly ready: boolean;
      readonly checkedAt: number;
    }>();
    expect(Object.keys(statusFor()).sort()).toEqual(['bot', 'checkedAt', 'cli', 'ready', 'user']);
  });

  it('分别显示 checking、connected、disconnected 三种笼统状态', () => {
    const html = renderAuthPanel(
      statusFor({ cli: 'checking', bot: 'connected', user: 'disconnected' }),
    );
    expect(html).toContain('检测中');
    expect(html).toContain('已连接');
    expect(html).toContain('未连接');
  });

  it('检测按钮紧跟该行状态文字，文案保留全称', () => {
    const html = renderAuthPanel(statusFor());
    expect(html).toMatch(/已连接<\/span><button[^>]*>检测 lark-cli<\/button>/);
    expect(html).toMatch(/已连接<\/span><button[^>]*>检测机器人身份<\/button>/);
    expect(html).toMatch(/已连接<\/span><button[^>]*>检测用户身份<\/button>/);
    expect(html).not.toMatch(/<span style="[^"]*flex:1[^"]*"[^>]*>已连接<\/span>/);
  });

  it('三个区域各有一个检测按钮，忙碌时全部禁用', () => {
    const detectButtons = /<button type="button" style=/g;
    const idle = renderAuthPanel(statusFor());
    expect(idle.match(detectButtons)).toHaveLength(3);
    expect(idle).not.toContain('disabled');

    const busy = renderAuthPanel(statusFor(), true);
    expect(busy.match(detectButtons)).toHaveLength(3);
    expect(busy.match(/<button type="button" style="[^"]*" disabled/g)).toHaveLength(3);
  });

  it('分别展示安装、机器人配置与用户登录的固定终端命令', () => {
    const html = renderAuthPanel(
      statusFor({ cli: 'disconnected', bot: 'disconnected', user: 'disconnected' }),
    );
    expect(html).toContain(CLI_COMMAND);
    expect(html).toContain(BOT_COMMAND);
    expect(html).toContain(USER_COMMAND);
    expect(html).not.toContain(`${CLI_COMMAND} &amp;&amp; ${BOT_COMMAND}`);
  });

  it('每条命令右侧有复制按钮，标签为复制命令', () => {
    const html = renderAuthPanel(statusFor());
    expect(html.match(/aria-label="复制命令"/g)).toHaveLength(3);
    expect(html).toMatch(/<code[^>]*>[^<]*<\/code><button[^>]*aria-label="复制命令"/);
    expect(html).toContain('data-dsh-lark-command-row="cli"');
    expect(html).toContain('data-dsh-lark-command-row="bot"');
    expect(html).toContain('data-dsh-lark-command-row="user"');
  });

  it('忽略 URL、原始错误与身份元数据', () => {
    const sensitiveStatus = {
      ...statusFor({ cli: 'disconnected', bot: 'disconnected', user: 'disconnected' }),
      appId: 'app-id-sensitive',
      userName: 'username-sensitive',
      ownerOpenId: 'open_id-sensitive',
      detail: 'raw-error-sensitive',
      verificationUrl: 'https://example.test/auth?token=token-sensitive',
      token: 'token-sensitive',
      scope: 'scope-sensitive',
    } as BridgeStatus;
    const html = renderToStaticMarkup(
      createElement(AuthPanelStatus, {
        t: translate(zh),
        status: sensitiveStatus,
        error: 'raw-error-sensitive',
        busy: false,
        onCheck: vi.fn(),
      } as never),
    );

    for (const sensitive of [
      'https://example.test/auth?token=token-sensitive',
      'raw-error-sensitive',
      'app-id-sensitive',
      'username-sensitive',
      'open_id-sensitive',
      'token-sensitive',
      'scope-sensitive',
    ]) {
      expect(html).not.toContain(sensitive);
    }
    expect(html).not.toContain('<a');
    expect(html).not.toContain('href=');
    expect(html.match(/--scope/g)).toHaveLength(1);
  });
});

describe('工作区选择与共用弹窗', () => {
  it('选项仅来自注册列表并归一化为 Linux 风格路径', () => {
    const options = workspaceOptions([
      { workspaceId: 'one', path: 'C:\\work\\demo\\One', title: '项目一' },
      { workspaceId: 'two', path: 'c:/work/demo/Two/', title: '项目二' },
    ]);
    expect(options).toEqual([
      { id: 'one', title: '项目一', path: '/c/work/demo/One' },
      { id: 'two', title: '项目二', path: '/c/work/demo/Two' },
    ]);

    const html = renderWorkspaceSelect(
      [{ workspaceId: 'one', path: 'C:\\work\\demo\\One', title: '项目一' }],
      'C:\\work\\demo\\One',
    );
    expect(html).toContain('项目一 — /c/work/demo/One');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('<select');
    expect(html).not.toContain('type="text"');
  });

  it('空注册列表显示空状态并禁用选择', () => {
    const html = renderWorkspaceSelect([]);
    expect(html).toContain('暂无已注册工作区');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('role="menu"');
  });

  it('配置页包含连接面板、工作区与模型行', () => {
    const html = renderConfigPage();
    expect(html).toContain('data-dsh-lark-auth-panel');
    expect(html).toContain('data-dsh-lark-config-workspace');
    expect(html).toContain('data-dsh-lark-config-model');
    expect(html).toContain('data-dsh-lark-model-select');
    expect(html).toContain('data-dsh-lark-config-preset');
    expect(html).toContain('data-dsh-lark-preset-trigger');
    expect(html).toContain('工作区');
    expect(html).toContain('模型');
    expect(html).toContain('预设');
    expect(html).not.toContain('恢复默认');
    expect(html).not.toContain('会话标题');
    expect(html).not.toContain('启动时检测鉴权');
    expect(html).not.toContain('重置桥接会话');
  });

  it('禁用保存按钮有明确禁用样式', () => {
    const html = renderAuthOverlayContent(formState());
    expect(html).toMatch(/<button\b[^>]*disabled[^>]*>保存选择<\/button>/);
    expect(html).toContain('cursor:not-allowed');
  });

  it('弹窗正文复用连接面板、选择器和显式保存按钮', () => {
    const html = renderAuthOverlayContent(formState({ dirty: true }));
    expect(html).toContain('data-dsh-lark-auth-panel');
    expect(html).toContain('data-dsh-lark-config-workspace');
    expect(html).toContain('保存选择');
    expect(html).toContain('工作区');
    expect(html).not.toContain('恢复默认');
    expect(html).not.toContain('<a');
  });
});

describe('AuthOverlay 状态', () => {
  it('路径归一化后生成有效签名，失效状态使用非空签名', () => {
    const paths = ['/c/work/demo/One'];
    expect(getAuthOverlaySignature(statusFor(), 'C:\\work\\demo\\One', paths)).toBe('');
    expect(getAuthOverlaySignature(statusFor(), '', paths)).not.toBe('');
    expect(
      getAuthOverlaySignature(statusFor({ user: 'disconnected' }), '/c/work/demo/One', paths),
    ).not.toBe('');
  });

  it('关闭后同签名不重复打开，新的失效与再次失效会重开', () => {
    const invalid = getAuthOverlaySignature(statusFor(), '', ['/c/work/demo/One']);
    const opened = reduceAuthOverlayState(INITIAL_AUTH_OVERLAY_STATE, {
      type: 'sync',
      signature: invalid,
    });
    const dismissed = reduceAuthOverlayState(opened, { type: 'dismiss' });
    expect(reduceAuthOverlayState(dismissed, { type: 'sync', signature: invalid }).open).toBe(
      false,
    );
    expect(reduceAuthOverlayState(dismissed, { type: 'sync', signature: 'new-invalid' }).open).toBe(
      true,
    );
    const valid = reduceAuthOverlayState(dismissed, { type: 'sync', signature: '' });
    expect(reduceAuthOverlayState(valid, { type: 'sync', signature: invalid }).open).toBe(true);
  });

  it('关闭并放弃草稿时吞掉恢复旧签名的一次同步', () => {
    const opened = reduceAuthOverlayState(INITIAL_AUTH_OVERLAY_STATE, {
      type: 'sync',
      signature: 'draft-valid',
    });
    const dismissed = reduceAuthOverlayState(opened, { type: 'discard' });
    const settled = reduceAuthOverlayState(dismissed, {
      type: 'sync',
      signature: 'saved-invalid',
    });
    expect(settled.open).toBe(false);
    expect(settled.signature).toBe('saved-invalid');
    expect(reduceAuthOverlayState(settled, { type: 'sync', signature: 'next-invalid' }).open).toBe(
      true,
    );
  });

  it('有效草稿未保存及未发起保存的 settle 均不关闭', () => {
    const closed = reduceAuthOverlayState(INITIAL_AUTH_OVERLAY_STATE, {
      type: 'sync',
      signature: '',
    });
    const editing = reduceAuthOverlayState(closed, { type: 'editStart' });
    expect(editing.open).toBe(true);
    expect(reduceAuthOverlayState(editing, { type: 'sync', signature: '' }).open).toBe(true);
    expect(
      reduceAuthOverlayState(editing, {
        type: 'saveSettled',
        saving: false,
        dirty: false,
        failed: false,
      }),
    ).toBe(editing);
  });

  it('保存中、仍脏或失败保持打开，只有保存成功关闭', () => {
    const editing = reduceAuthOverlayState(INITIAL_AUTH_OVERLAY_STATE, { type: 'editStart' });
    const saving = reduceAuthOverlayState(editing, { type: 'saveStart' });
    for (const result of [
      { saving: true, dirty: true, failed: false },
      { saving: false, dirty: true, failed: false },
      { saving: false, dirty: false, failed: true },
    ]) {
      expect(reduceAuthOverlayState(saving, { type: 'saveSettled', ...result }).open).toBe(true);
    }
    expect(
      reduceAuthOverlayState(saving, {
        type: 'saveSettled',
        saving: false,
        dirty: false,
        failed: false,
      }).open,
    ).toBe(false);
  });
});

describe('字典', () => {
  it('中英字典键集一致且无空文案', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
    for (const value of [...Object.values(en), ...Object.values(zh)]) {
      expect(value.trim()).not.toBe('');
    }
  });
});

describe('StatusController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('加载时完整检测一次，定时轮询只读取状态并通知订阅者', async () => {
    const initial = statusFor({ user: 'disconnected' });
    const polled = statusFor();
    const checkAuth = vi.fn(async (): Promise<ApiResult<BridgeStatus>> => ok(initial));
    const fetchStatus = vi.fn(async (): Promise<ApiResult<BridgeStatus>> => ok(polled));
    const controller = new StatusController({ fetchStatus, checkAuth });

    expect(checkAuth).toHaveBeenCalledTimes(1);
    expect(fetchStatus).not.toHaveBeenCalled();
    expect(controller.getSnapshot().busy).toBe(true);
    await flushPromises();
    expect(controller.getSnapshot()).toMatchObject({ status: initial, busy: false });

    const listener = vi.fn();
    controller.subscribe(listener);
    listener.mockClear();
    await vi.advanceTimersToNextTimerAsync();
    await flushPromises();

    expect(checkAuth).toHaveBeenCalledTimes(1);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({ status: polled, busy: false });
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ status: polled }));
    controller.dispose();
  });

  it('并发手动检测共享同一次请求与 busy 状态', async () => {
    const initial = statusFor({ bot: 'disconnected' });
    const checked = statusFor();
    const pending = deferred<ApiResult<BridgeStatus>>();
    const checkAuth = vi
      .fn<() => Promise<ApiResult<BridgeStatus>>>()
      .mockResolvedValueOnce(ok(initial))
      .mockReturnValueOnce(pending.promise);
    const fetchStatus = vi.fn(async (): Promise<ApiResult<BridgeStatus>> => ok(initial));
    const controller = new StatusController({ fetchStatus, checkAuth });
    await flushPromises();
    const listener = vi.fn();
    controller.subscribe(listener);
    listener.mockClear();

    const first = controller.check();
    const second = controller.check();
    expect(checkAuth).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().busy).toBe(true);
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ busy: true }));

    pending.resolve(ok(checked));
    await Promise.all([first, second]);
    await flushPromises();
    expect(controller.getSnapshot()).toMatchObject({ status: checked, busy: false });
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: checked, busy: false }),
    );
    controller.dispose();
  });

  it('dispose 清理轮询计时器与订阅监听', async () => {
    const pending = deferred<ApiResult<BridgeStatus>>();
    const checkAuth = vi.fn((): Promise<ApiResult<BridgeStatus>> => pending.promise);
    const fetchStatus = vi.fn(async (): Promise<ApiResult<BridgeStatus>> => ok(statusFor()));
    const controller = new StatusController({ fetchStatus, checkAuth });
    const listener = vi.fn();
    controller.subscribe(listener);
    listener.mockClear();

    expect(vi.getTimerCount()).toBe(1);
    controller.dispose();
    expect(vi.getTimerCount()).toBe(0);

    pending.resolve(ok(statusFor()));
    await flushPromises();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchStatus).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('预设选择器文案', () => {
  /** 构造选择器状态。 */
  function state(overrides: Partial<PresetDefaultsState> = {}): PresetDefaultsState {
    return { status: 'ready', error: null, rows: [], current: '', ...overrides };
  }

  /** 用给定状态静态渲染选择器。 */
  function renderPreset(value: PresetDefaultsState): string {
    const store = createSnapshotStore<PresetDefaultsState>(value);
    return renderToStaticMarkup(
      createElement(PresetSelect, {
        hooks: { presetDefaults: store },
        load: () => undefined,
        select: () => undefined,
        locked: false,
        t: translate(zh),
      }),
    );
  }

  it('旧配置的空值显示跟随宿主默认', () => {
    expect(currentText(state(), translate(zh))).toBe('跟随宿主默认');
    expect(
      currentText(state({ rows: [{ id: 'a', name: 'A' }], current: 'a' }), translate(zh)),
    ).toBe('A');
  });

  it('已存预设不可用时追加不可用标注', () => {
    const text = currentText(state({ current: 'gone' }), translate(zh));
    expect(text).toBe('gone · 不可用');
  });

  it('加载中、无服务与失败各有文案', () => {
    expect(currentText(state({ status: 'loading' }), translate(zh))).toBe('加载中…');
    expect(currentText(state({ status: 'noService' }), translate(zh))).toBe('此部署不提供预设');
    expect(currentText(state({ status: 'error' }), translate(zh))).toBe('预设加载失败');
  });

  it('无预设能力时触发器禁用并说明原因', () => {
    const html = renderPreset(state({ status: 'noService' }));
    expect(html).toContain('此部署不提供预设');
    expect(html).toContain('disabled=""');
  });

  it('加载失败时显示重试', () => {
    const html = renderPreset(state({ status: 'error', error: '失败了' }));
    expect(html).toContain('失败了');
    expect(html).toContain('重试');
    expect(html).toContain('role="alert"');
  });

  it('已存预设不可用时触发器显示标注', () => {
    const html = renderPreset(state({ current: 'gone' }));
    expect(html).toContain('gone · 不可用');
  });

  it('菜单只列可用预设，不可用的已存值以禁用项补足', () => {
    const items = menuItems(
      state({ rows: [{ id: 'a', name: 'A' }], current: 'gone' }),
      translate(zh),
    );
    expect(items[0]).toMatchObject({ id: 'a', label: 'A' });
    expect(items[1]).toMatchObject({ id: 'gone', disabled: true });
    expect(items.some((item) => item.id === '')).toBe(false);
  });
});
