/**
 * 插件配置：schema、默认值与严格校验。
 * 导出 Config、PluginConfig、resolveConfig 与 readConfig。
 */
import { homedir } from 'node:os';
import { join } from 'node:path';
import Schema from '@deepseek-ai/schemastery';

import {
  DEFAULT_PROFILE,
  DEFAULT_SESSION_TITLE,
  PLUGIN_LABEL,
  STATE_DIR,
  STATE_FILE,
} from './constants.ts';
import type { Volatile } from './types.ts';
import { isRecord } from './utils.ts';

/** 宿主传给 apply 的配置：每个字段是热重载引用，用 `.get()` 读取实时值。 */
export interface Config {
  /** 桥接会话所属工作区；空值表示尚未配置。 */
  workspaceRoot: Volatile<string>;
  /** 桥接会话标题。 */
  sessionTitle: Volatile<string>;
  /** 插件专用 lark-cli 配置档案名。 */
  profile: Volatile<string>;
  /** 显式 lark-cli 可执行文件或入口脚本；空值自动解析。 */
  larkCli: Volatile<string>;
  /** 显式指定已绑定用户的 open_id；空值使用授权结果。 */
  ownerOpenId: Volatile<string>;
  /** 每次加载是否执行鉴权检查。 */
  authCheckOnStartup: Volatile<boolean>;
}

/**
 * 配置 schema。`.volatile()` 字段修改后不重启插件，并出现在配置页。
 * schema 不拒绝未知键，严格校验由 resolveConfig 完成。
 */
export const Config: Schema<Config> = Schema.object({
  workspaceRoot: Schema.string().default('').volatile(),
  sessionTitle: Schema.string().default(DEFAULT_SESSION_TITLE).volatile(),
  profile: Schema.string()
    .default(DEFAULT_PROFILE)
    .pattern(/^[A-Za-z0-9._-]+$/)
    .volatile(),
  larkCli: Schema.string().default('').volatile(),
  ownerOpenId: Schema.string().default('').volatile(),
  authCheckOnStartup: Schema.boolean().default(true).volatile(),
}) as unknown as Schema<Config>;

/** 配置项的实时取值。 */
export interface PluginConfig {
  workspaceRoot: string;
  sessionTitle: string;
  profile: string;
  larkCli: string;
  ownerOpenId: string;
  authCheckOnStartup: boolean;
}

/** 默认配置。 */
export const DEFAULT_CONFIG: Readonly<PluginConfig> = Object.freeze({
  workspaceRoot: '',
  sessionTitle: DEFAULT_SESSION_TITLE,
  profile: DEFAULT_PROFILE,
  larkCli: '',
  ownerOpenId: '',
  authCheckOnStartup: true,
});

/** 合法的配置键。出现其他键时报错。 */
const CONFIG_KEYS = new Set<string>([
  'workspaceRoot',
  'sessionTitle',
  'profile',
  'larkCli',
  'ownerOpenId',
  'authCheckOnStartup',
]);

/** 把缺省或 null 的输入转为空对象。 */
function normalizeConfigInput(raw: unknown): Record<string, unknown> {
  if (raw === undefined || raw === null) return {};
  if (!isRecord(raw)) throw new Error(`${PLUGIN_LABEL}: config must be an object`);
  return raw;
}

/** 读取一个字符串字段并 trim；缺省或 null 用默认值。 */
function stringField(
  input: Record<string, unknown>,
  key: keyof PluginConfig,
  fallback: string,
  validate: (value: string) => void,
): string {
  const raw = input[key];
  if (raw === undefined || raw === null) return fallback;
  if (typeof raw !== 'string') throw new Error(`${PLUGIN_LABEL}: config ${key} must be a string`);
  const value = raw.trim();
  validate(value);
  return value;
}

/** 校验配置并与默认值合并，返回冻结的完整配置。 */
export function resolveConfig(raw?: unknown): Readonly<PluginConfig> {
  const input = normalizeConfigInput(raw);
  for (const key of Object.keys(input)) {
    if (!CONFIG_KEYS.has(key)) throw new Error(`${PLUGIN_LABEL}: unknown config key "${key}"`);
  }
  const config: PluginConfig = { ...DEFAULT_CONFIG };

  config.workspaceRoot = stringField(
    input,
    'workspaceRoot',
    DEFAULT_CONFIG.workspaceRoot,
    () => {},
  );
  config.sessionTitle = stringField(input, 'sessionTitle', DEFAULT_CONFIG.sessionTitle, (value) => {
    if (value === '') throw new Error(`${PLUGIN_LABEL}: config sessionTitle must not be empty`);
  });
  config.profile = stringField(input, 'profile', DEFAULT_CONFIG.profile, (value) => {
    if (!/^[A-Za-z0-9._-]+$/.test(value)) {
      throw new Error(`${PLUGIN_LABEL}: config profile must match [A-Za-z0-9._-]+`);
    }
  });
  config.larkCli = stringField(input, 'larkCli', DEFAULT_CONFIG.larkCli, () => {});
  config.ownerOpenId = stringField(input, 'ownerOpenId', DEFAULT_CONFIG.ownerOpenId, (value) => {
    if (value !== '' && !value.startsWith('ou_')) {
      throw new Error(`${PLUGIN_LABEL}: config ownerOpenId must start with "ou_"`);
    }
  });

  const authCheck = input.authCheckOnStartup;
  if (authCheck !== undefined && authCheck !== null) {
    if (typeof authCheck !== 'boolean') {
      throw new Error(`${PLUGIN_LABEL}: config authCheckOnStartup must be a boolean`);
    }
    config.authCheckOnStartup = authCheck;
  }

  return Object.freeze(config);
}

/** 判断值是否是热重载引用。 */
function isVolatileRef(value: unknown): value is { get(): unknown } {
  return isRecord(value) && typeof value.get === 'function';
}

/** 读取宿主传入配置的当前值：展开热重载引用后交给 resolveConfig 校验。 */
export function readConfig(config?: unknown): Readonly<PluginConfig> {
  if (!isRecord(config)) return resolveConfig(config);
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    values[key] = isVolatileRef(value) ? value.get() : value;
  }
  return resolveConfig(values);
}

/**
 * 解析插件状态文件路径。
 * @param home - DSH home；省略时读取 `DSH_HOME`，再回落到 `~/.dsh`。
 * @returns `state.json` 的绝对路径。
 */
export function statePath(home?: string): string {
  const root = home ?? process.env['DSH_HOME'] ?? join(homedir(), '.dsh');
  return join(root, STATE_DIR, STATE_FILE);
}
