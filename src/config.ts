/** 插件配置：单工作区 schema、路径归一化、严格校验与旧键兼容。 */
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ModelSelection } from '@deepseek-ai/dsh-agent';
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import Schema from '@deepseek-ai/schemastery';

import { PLUGIN_LABEL, STATE_DIR, STATE_FILE } from './constants.ts';
import type { Volatile } from './types.ts';
import { isRecord } from './utils.ts';
import { normalizeWorkspacePath } from './workspace-path.ts';

/** 宿主传给 apply 的配置：字段是热重载引用，用 `.get()` 读取实时值。 */
export interface Config {
  /** 桥接会话所属工作区；空值表示尚未选择。 */
  workspaceRoot: Volatile<string>;
  /** 新建桥接会话的 provider；与 sessionModel 成对。 */
  sessionProvider: Volatile<string>;
  /** 新建桥接会话的 model；与 sessionProvider 成对。 */
  sessionModel: Volatile<string>;
  /** 新建桥接会话的推理等级；仅在模型成对时生效。 */
  sessionEffort: Volatile<string>;
  /** 新建桥接会话的预设；缺省为 sa-dispatch，空值表示跟随宿主默认。 */
  sessionPreset: Volatile<string>;
}

/** 配置 schema；严格键校验由 resolveConfig 完成。 */
export const Config: Schema<Config> = Schema.object({
  workspaceRoot: Schema.string().default('').volatile(),
  sessionProvider: Schema.string().default('').volatile(),
  sessionModel: Schema.string().default('').volatile(),
  sessionEffort: Schema.string().default('').volatile(),
  sessionPreset: Schema.string().default('sa-dispatch').volatile(),
}) as unknown as Schema<Config>;

/** 配置项的实时取值。 */
export interface PluginConfig {
  workspaceRoot: string;
  sessionProvider: string;
  sessionModel: string;
  sessionEffort: string;
  sessionPreset: string;
}

/** 默认配置。 */
export const DEFAULT_CONFIG: Readonly<PluginConfig> = Object.freeze({
  workspaceRoot: '',
  sessionProvider: '',
  sessionModel: '',
  sessionEffort: '',
  sessionPreset: 'sa-dispatch',
});

/** 合法的当前配置键。 */
const CONFIG_KEYS = new Set<string>([
  'workspaceRoot',
  'sessionProvider',
  'sessionModel',
  'sessionEffort',
  'sessionPreset',
]);

/** 需要校验为字符串的配置键。 */
const STRING_KEYS = [
  'workspaceRoot',
  'sessionProvider',
  'sessionModel',
  'sessionEffort',
  'sessionPreset',
] as const;

/** 旧版本的配置键：接受并丢弃，避免升级后插件加载失败。 */
const LEGACY_KEYS = new Set<string>([
  'profile',
  'ownerOpenId',
  'larkCli',
  'sessionTitle',
  'authCheckOnStartup',
]);

/** 把缺省或 null 的输入转为空对象。 */
function normalizeConfigInput(raw: unknown): Record<string, unknown> {
  if (raw === undefined || raw === null) return {};
  if (!isRecord(raw)) throw new Error(`${PLUGIN_LABEL}: config must be an object`);
  return raw;
}

/** 校验配置并与默认值合并，工作区路径统一为 Linux 风格。 */
export function resolveConfig(raw?: unknown): Readonly<PluginConfig> {
  const input = normalizeConfigInput(raw);
  for (const key of Object.keys(input)) {
    if (!CONFIG_KEYS.has(key) && !LEGACY_KEYS.has(key))
      throw new Error(`${PLUGIN_LABEL}: unknown config key "${key}"`);
  }
  for (const key of STRING_KEYS) {
    const value = input[key];
    if (value !== undefined && value !== null && typeof value !== 'string') {
      throw new Error(`${PLUGIN_LABEL}: config ${key} must be a string`);
    }
  }
  const text = (key: (typeof STRING_KEYS)[number]): string => {
    const value = input[key];
    return typeof value === 'string' ? value : DEFAULT_CONFIG[key];
  };
  return Object.freeze({
    workspaceRoot: normalizeWorkspacePath(text('workspaceRoot')),
    sessionProvider: text('sessionProvider'),
    sessionModel: text('sessionModel'),
    sessionEffort: text('sessionEffort'),
    sessionPreset: text('sessionPreset'),
  });
}

/**
 * 从配置派生新建会话的模型选择。
 * provider 与 model 同时非空才成立；effort 只在模型成立时生效。
 */
export function modelSelectionOf(config: Readonly<PluginConfig>): ModelSelection | undefined {
  const provider = config.sessionProvider.trim();
  const model = config.sessionModel.trim();
  if (provider === '' || model === '') return undefined;
  const effort = config.sessionEffort.trim();
  return {
    provider,
    model,
    ...(effort === '' ? {} : { reasoningEffort: ReasoningEffortId(effort) }),
  };
}

/** 从配置派生新建会话的预设标识；空白按未配置处理。 */
export function presetOf(config: Readonly<PluginConfig>): string {
  return config.sessionPreset.trim();
}

/** 判断值是否是热重载引用。 */
function isVolatileRef(value: unknown): value is { get(): unknown } {
  return isRecord(value) && typeof value.get === 'function';
}

/** 展开热重载引用后交给 resolveConfig 校验。 */
export function readConfig(config?: unknown): Readonly<PluginConfig> {
  if (!isRecord(config)) return resolveConfig(config);
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    values[key] = isVolatileRef(value) ? value.get() : value;
  }
  return resolveConfig(values);
}

/** 解析插件状态目录。 */
export function stateRoot(home?: string): string {
  const root = home ?? process.env['DSH_HOME'] ?? join(homedir(), '.dsh');
  return join(root, STATE_DIR);
}

/** 解析插件状态文件路径。 */
export function statePath(home?: string): string {
  return join(stateRoot(home), STATE_FILE);
}
