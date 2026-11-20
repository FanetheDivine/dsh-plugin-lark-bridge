/** 插件配置：单工作区 schema、路径归一化、严格校验与旧键兼容。 */
import { homedir } from 'node:os';
import { join } from 'node:path';
import Schema from '@deepseek-ai/schemastery';

import { PLUGIN_LABEL, STATE_DIR, STATE_FILE } from './constants.ts';
import type { Volatile } from './types.ts';
import { isRecord } from './utils.ts';
import { normalizeWorkspacePath } from './workspace-path.ts';

/** 宿主传给 apply 的配置：字段是热重载引用，用 `.get()` 读取实时值。 */
export interface Config {
  /** 桥接会话所属工作区；空值表示尚未选择。 */
  workspaceRoot: Volatile<string>;
}

/** 配置 schema；严格键校验由 resolveConfig 完成。 */
export const Config: Schema<Config> = Schema.object({
  workspaceRoot: Schema.string().default('').volatile(),
}) as unknown as Schema<Config>;

/** 配置项的实时取值。 */
export interface PluginConfig {
  workspaceRoot: string;
}

/** 默认配置。 */
export const DEFAULT_CONFIG: Readonly<PluginConfig> = Object.freeze({ workspaceRoot: '' });

/** 合法的当前配置键。 */
const CONFIG_KEYS = new Set<string>(['workspaceRoot']);

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
  const value = input['workspaceRoot'];
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new Error(`${PLUGIN_LABEL}: config workspaceRoot must be a string`);
  }
  return Object.freeze({
    workspaceRoot:
      typeof value === 'string' ? normalizeWorkspacePath(value) : DEFAULT_CONFIG.workspaceRoot,
  });
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

/** 解析插件状态文件路径。 */
export function statePath(home?: string): string {
  const root = home ?? process.env['DSH_HOME'] ?? join(homedir(), '.dsh');
  return join(root, STATE_DIR, STATE_FILE);
}
