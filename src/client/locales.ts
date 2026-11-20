/** 前端字典与命名空间。中文字典是键集事实源。 */

/** 前端使用的字典命名空间，与插件名一致。 */
export const NS = 'dsh-plugin-lark-bridge';

/** 中文字典。 */
export const zh = {
  'auth.title': '飞书桥接设置',
  'auth.description': '完成连接检查并选择工作区。命令需要在终端执行。',
  'auth.ready': '飞书连接已就绪',
  'auth.close': '本次不再提示',
  'auth.openSettings': '打开设置',
  'auth.name.cli': 'lark-cli',
  'auth.name.bot': '机器人身份（bot）',
  'auth.name.user': '用户身份（user）',
  'auth.state.checking': '检测中…',
  'auth.state.connected': '已连接',
  'auth.state.disconnected': '未连接',
  'auth.check.cli': '检测 lark-cli',
  'auth.check.bot': '检测机器人身份',
  'auth.check.user': '检测用户身份',
  'auth.command.cli': 'npm install -g @larksuite/cli@latest',
  'auth.command.bot': 'lark-cli config init',
  'auth.command.user': 'lark-cli auth login --scope auth:user.id:read',
  'auth.command.copy': '复制命令',
  'auth.command.copied': '已复制',
  'config.summary': '工作区与飞书连接',
  'config.workspaceRoot.title': '工作区',
  'config.workspaceRoot.description': '飞书消息注入到所选 DSH 工作区的会话。',
  'config.workspaceRoot.invalid': '请选择一个已注册的工作区。',
  'config.workspaceRoot.placeholder': '请选择工作区',
  'config.workspaceRoot.empty': '暂无已注册工作区',
  'config.saveSelection': '保存选择',
  'config.unavailable': '配置不可用。',
  'config.readOnly': '此部署以只读方式保存设置。',
  'config.saveFailed': '此部署未接受这些值，已保留以便修改。',
  'config.save': '保存',
  'config.saving': '保存中…',
} as const;

/** 英文字典，键集与中文一致。 */
export const en: Record<BridgeKey, string> = {
  'auth.title': 'Lark bridge setup',
  'auth.description': 'Check the connections and select a workspace. Run commands in a terminal.',
  'auth.ready': 'Lark connections are ready',
  'auth.close': 'Not now',
  'auth.openSettings': 'Open settings',
  'auth.name.cli': 'lark-cli',
  'auth.name.bot': 'Bot identity',
  'auth.name.user': 'User identity',
  'auth.state.checking': 'Checking…',
  'auth.state.connected': 'Connected',
  'auth.state.disconnected': 'Disconnected',
  'auth.check.cli': 'Check lark-cli',
  'auth.check.bot': 'Check bot identity',
  'auth.check.user': 'Check user identity',
  'auth.command.cli': 'npm install -g @larksuite/cli@latest',
  'auth.command.bot': 'lark-cli config init',
  'auth.command.user': 'lark-cli auth login --scope auth:user.id:read',
  'auth.command.copy': 'Copy command',
  'auth.command.copied': 'Copied',
  'config.summary': 'Workspace and Lark connections',
  'config.workspaceRoot.title': 'Workspace',
  'config.workspaceRoot.description': 'Lark messages are injected into the selected DSH workspace.',
  'config.workspaceRoot.invalid': 'Select a registered workspace.',
  'config.workspaceRoot.placeholder': 'Select a workspace',
  'config.workspaceRoot.empty': 'No registered workspaces',
  'config.saveSelection': 'Save selection',
  'config.unavailable': 'Configuration is unavailable.',
  'config.readOnly': 'This deployment stores settings read-only.',
  'config.saveFailed':
    'The deployment did not accept these values; they were left for you to correct.',
  'config.save': 'Save',
  'config.saving': 'Saving…',
};

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** 飞书桥接前端文案，键集取自中文字典。 */
    'dsh-plugin-lark-bridge': BridgeKey;
  }
}

/** 飞书桥接前端可用的字典键。 */
export type BridgeKey = keyof typeof zh;
