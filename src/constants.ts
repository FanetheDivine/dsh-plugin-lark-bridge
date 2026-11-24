/** 共享常量：插件标识、默认值、工具名与状态目录。 */

/** 插件标识，与包名、cordis.patch.yml 的 id 一致。 */
export const PLUGIN_LABEL = 'dsh-plugin-lark-bridge';

/** 工具名。 */
export const NOTIFY_TOOL_NAME = 'lark_notify';

/** 桥接会话的固定标题。 */
export const SESSION_TITLE = '飞书桥接会话';

/** 状态目录名，位于 DSH home 下。 */
export const STATE_DIR = 'lark-bridge';

/** 状态文件名。 */
export const STATE_FILE = 'state.json';

/** 去重窗口最多保留的消息条数。 */
export const SEEN_LIMIT = 500;

/** 单条飞书文本消息的最大字符数。 */
export const MAX_MESSAGE_CHARS = 15_000;

/** 引用正文最多保留的字符数。 */
export const QUOTE_MAX_CHARS = 500;

/** 读取被引消息单次调用的超时毫秒数。 */
export const QUOTE_TIMEOUT_MS = 8_000;

/** 监听重启的初始与最大退避。 */
export const RESTART_MIN_MS = 2_000;
export const RESTART_MAX_MS = 60_000;

/** 节假日缓存文件名，位于状态目录。 */
export const HOLIDAY_CACHE_FILE = 'holiday-cache.json';

/** 节假日数据主源；`<year>` 由调用方替换。 */
export const HOLIDAY_SOURCE_PRIMARY =
  'https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/<year>.json';

/** 节假日数据备源。 */
export const HOLIDAY_SOURCE_FALLBACK =
  'https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/<year>.json';

/** 节假日缓存的过期时长。 */
export const HOLIDAY_TTL_MS = 24 * 60 * 60 * 1000;

/** 获取失败后的退避时长。 */
export const HOLIDAY_RETRY_MS = 60 * 60 * 1000;

/** 单次获取的超时毫秒数。 */
export const HOLIDAY_TIMEOUT_MS = 8_000;

/** 在场状态到点判定的间隔。 */
export const PRESENCE_TICK_MS = 15_000;
