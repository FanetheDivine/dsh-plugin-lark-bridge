/** 共享常量：插件标识、默认值、工具名与状态目录。 */

/** 插件标识，与包名、cordis.patch.yml 的 id 一致。 */
export const PLUGIN_LABEL = 'dsh-plugin-lark-bridge';

/** 工具名。 */
export const NOTIFY_TOOL_NAME = 'lark_notify';

/** 桥接会话的固定标题。 */
export const SESSION_TITLE = '来自用户的飞书消息';

/** 状态目录名，位于 DSH home 下。 */
export const STATE_DIR = 'lark-bridge';

/** 状态文件名。 */
export const STATE_FILE = 'state.json';

/** 去重窗口最多保留的消息条数。 */
export const SEEN_LIMIT = 500;

/** 单条飞书文本消息的最大字符数。 */
export const MAX_MESSAGE_CHARS = 15_000;

/** 监听重启的初始与最大退避。 */
export const RESTART_MIN_MS = 2_000;
export const RESTART_MAX_MS = 60_000;
