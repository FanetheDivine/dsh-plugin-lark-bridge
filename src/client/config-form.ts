/** 插件配置草稿：工作区路径与新建会话的模型、预设。 */
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type {
  SettingsFieldSpec,
  SettingsFieldState,
  SettingsFormActions,
  SettingsFormScope,
  SettingsFormShell,
} from '@deepseek-ai/dsh-client-ui-primitives';
import { SettingsFormModel, settingsTextField } from '@deepseek-ai/dsh-client-ui-primitives';

import { normalizeWorkspacePath } from '../workspace-path.ts';

/** 插件在前端使用的行键：`<包名>#<行 id>`。 */
export const ROW_KEY = 'dsh-plugin-lark-bridge#dsh-plugin-lark-bridge';

/** 行 id，同时是宿主配置的条目 id 与表单命名空间。 */
export const ROW_ID = 'dsh-plugin-lark-bridge';

/** 配置页可编辑字段。 */
export interface ConfigFields {
  workspaceRoot: string;
  sessionProvider: string;
  sessionModel: string;
  sessionEffort: string;
  sessionPreset: string;
}

/** 配置页读取的草稿与表单状态。 */
export interface ConfigFormState extends SettingsFormShell {
  workspaceRoot: SettingsFieldState;
  sessionProvider: SettingsFieldState;
  sessionModel: SettingsFieldState;
  sessionEffort: SettingsFieldState;
  sessionPreset: SettingsFieldState;
}

/** 配置页向槽位组件提供的注入值。 */
export interface ConfigPageInjected extends SettingsFormActions {
  hooks: { configForm: SnapshotStore<ConfigFormState> };
}

const workspaceSpec: SettingsFieldSpec = {
  field: 'workspaceRoot',
  format: (value) => (typeof value === 'string' ? normalizeWorkspacePath(value) : ''),
  parse: (text) => {
    const path = normalizeWorkspacePath(text);
    return path.startsWith('/') ? { kind: 'set', value: path } : undefined;
  },
};

const SESSION_FIELDS = [
  'sessionProvider',
  'sessionModel',
  'sessionEffort',
  'sessionPreset',
] as const;

const FIELD_SPECS: SettingsFieldSpec[] = [
  workspaceSpec,
  ...SESSION_FIELDS.map((field) => settingsTextField(field)),
];

/** 暂存配置编辑，保存时写入宿主配置。 */
export class PluginConfigForm {
  private readonly form: SettingsFormModel<ConfigFields>;
  private readonly state: SnapshotStore<ConfigFormState>;

  /** @param scope - 宿主为该行提供的配置表单。 */
  constructor(scope: SettingsFormScope<ConfigFields>) {
    this.form = new SettingsFormModel(scope, FIELD_SPECS);
    this.state = this.form.bind(() => ({
      ...this.form.shell(),
      workspaceRoot: this.form.field('workspaceRoot'),
      sessionProvider: this.form.field('sessionProvider'),
      sessionModel: this.form.field('sessionModel'),
      sessionEffort: this.form.field('sessionEffort'),
      sessionPreset: this.form.field('sessionPreset'),
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
