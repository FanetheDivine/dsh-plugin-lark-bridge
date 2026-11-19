/**
 * 插件面板配置页的草稿模型：工作区、标题、lark-cli 路径与鉴权开关。
 * 导出行键、PluginConfigForm 与注入面类型。
 */
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type {
  SettingsFieldSpec,
  SettingsFieldState,
  SettingsFormActions,
  SettingsFormScope,
  SettingsFormShell,
} from '@deepseek-ai/dsh-client-ui-primitives';
import { SettingsFormModel } from '@deepseek-ai/dsh-client-ui-primitives';

/** 插件在前端使用的行键：`<包名>#<行 id>`。 */
export const ROW_KEY = 'dsh-plugin-lark-bridge#dsh-plugin-lark-bridge';

/** 行 id，同时是宿主配置的条目 id 与表单命名空间。 */
export const ROW_ID = 'dsh-plugin-lark-bridge';

/** 配置页可编辑字段。 */
export interface ConfigFields {
  workspaceRoot: string;
  sessionTitle: string;
  larkCli: string;
  authCheckOnStartup: boolean;
}

/** 配置页读取的草稿与表单状态。 */
export interface ConfigFormState extends SettingsFormShell {
  workspaceRoot: SettingsFieldState;
  sessionTitle: SettingsFieldState;
  larkCli: SettingsFieldState;
  authCheckOnStartup: SettingsFieldState;
}

/** 配置页向槽位组件提供的注入值。 */
export interface ConfigPageInjected extends SettingsFormActions {
  hooks: { configForm: SnapshotStore<ConfigFormState> };
}

/** 判断路径是否为绝对路径。 */
function isAbsolutePath(value: string): boolean {
  return /^(?:[A-Za-z]:[\\/]|\\\\|\/)/.test(value);
}

const workspaceSpec: SettingsFieldSpec = {
  field: 'workspaceRoot',
  format: (value) => (typeof value === 'string' ? value : ''),
  parse: (text) => {
    const path = text.trim();
    return isAbsolutePath(path) ? { kind: 'set', value: path } : undefined;
  },
};

const titleSpec: SettingsFieldSpec = {
  field: 'sessionTitle',
  format: (value) => (typeof value === 'string' ? value : ''),
  parse: (text) => {
    const title = text.trim();
    return title === '' ? undefined : { kind: 'set', value: title };
  },
};

const cliSpec: SettingsFieldSpec = {
  field: 'larkCli',
  format: (value) => (typeof value === 'string' ? value : ''),
  parse: (text) => ({ kind: 'set', value: text.trim() }),
};

const authCheckSpec: SettingsFieldSpec = {
  field: 'authCheckOnStartup',
  format: (value) => (value === false ? 'false' : 'true'),
  parse: (text) =>
    text === 'true' || text === 'false' ? { kind: 'set', value: text === 'true' } : undefined,
};

/** 暂存配置页的编辑，保存时一次写入宿主配置。 */
export class PluginConfigForm {
  private readonly form: SettingsFormModel<ConfigFields>;
  private readonly state: SnapshotStore<ConfigFormState>;

  /** @param scope - 宿主为该行提供的配置表单。 */
  constructor(scope: SettingsFormScope<ConfigFields>) {
    this.form = new SettingsFormModel(scope, [workspaceSpec, titleSpec, cliSpec, authCheckSpec]);
    this.state = this.form.bind(() => ({
      ...this.form.shell(),
      workspaceRoot: this.form.field('workspaceRoot'),
      sessionTitle: this.form.field('sessionTitle'),
      larkCli: this.form.field('larkCli'),
      authCheckOnStartup: this.form.field('authCheckOnStartup'),
    }));
  }

  /** @returns 配置页向槽位组件提供的注入值。 */
  inject(): ConfigPageInjected {
    return { hooks: { configForm: this.state }, ...this.form.actions() };
  }

  /** 释放对宿主表单的订阅。 */
  dispose(): void {
    this.form.dispose();
  }
}
