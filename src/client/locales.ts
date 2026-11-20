/** 前端字典与命名空间。中文字典是键集事实源。 */

/** 前端使用的字典命名空间，与插件名一致。 */
export const NS = 'dsh-plugin-lark-bridge';

/** 中文字典。 */
export const zh = {
  'auth.title': '飞书连接尚未就绪',
  'auth.description': '在终端完成对应命令，然后点击检测。界面只显示连接状态。',
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
  'config.summary': '工作区与飞书连接',
  'config.section.session': '会话',
  'config.workspaceRoot.title': '工作区',
  'config.workspaceRoot.description': '飞书消息注入到所选 DSH 工作区的会话。',
  'config.workspaceRoot.invalid': '请选择一个已注册的工作区。',
  'config.sessionTitle.title': '会话标题',
  'config.sessionTitle.description': '桥接会话显示的名称；修改后下一个消息会同步到会话。',
  'config.sessionTitle.invalid': '标题不能为空。',
  'config.authCheckOnStartup.title': '启动时检测鉴权',
  'config.authCheckOnStartup.description': '每次打开 DSH 都检查一次；失败时显示提示弹窗。',
  'config.resetSession': '重置桥接会话',
  'config.resetSessionHint': '清除已记录的会话标识，下一条飞书消息会在工作区新建会话。',
  'config.resetDone': '会话记录已清除。',
  'config.unavailable': '配置不可用。',
  'config.readOnly': '此部署以只读方式保存设置。',
  'config.saveFailed': '此部署未接受这些值，已保留以便修改。',
  'config.save': '保存',
  'config.saving': '保存中…',
  'config.overridden': '已覆盖',
  'config.reset': '恢复默认',
  'config.currentSession': '当前会话：{session}',
  'config.noSession': '尚未创建桥接会话。',
} as const;

/** 英文字典，键集与中文一致。 */
export const en: Record<BridgeKey, string> = {
  'auth.title': 'Lark connections are not ready',
  'auth.description':
    'Run the corresponding command in a terminal, then check again. Only connection states are shown.',
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
  'config.summary': 'Workspace and Lark connections',
  'config.section.session': 'Session',
  'config.workspaceRoot.title': 'Workspace',
  'config.workspaceRoot.description': 'Lark messages are injected into the selected DSH workspace.',
  'config.workspaceRoot.invalid': 'Select a registered workspace.',
  'config.sessionTitle.title': 'Session title',
  'config.sessionTitle.description':
    'The bridge session name; changes apply with the next message.',
  'config.sessionTitle.invalid': 'The title must not be empty.',
  'config.authCheckOnStartup.title': 'Check authentication on startup',
  'config.authCheckOnStartup.description':
    'Run one check whenever DSH opens and show the notice when it fails.',
  'config.resetSession': 'Reset bridge session',
  'config.resetSessionHint':
    'Clears the recorded session id; the next Lark message creates a new session in the workspace.',
  'config.resetDone': 'The session record was cleared.',
  'config.unavailable': 'Configuration is unavailable.',
  'config.readOnly': 'This deployment stores settings read-only.',
  'config.saveFailed':
    'The deployment did not accept these values; they were left for you to correct.',
  'config.save': 'Save',
  'config.saving': 'Saving…',
  'config.overridden': 'Overridden',
  'config.reset': 'Restore default',
  'config.currentSession': 'Current session: {session}',
  'config.noSession': 'No bridge session yet.',
};

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** 飞书桥接前端文案，键集取自中文字典。 */
    'dsh-plugin-lark-bridge': BridgeKey;
  }
}

/** 飞书桥接前端可用的字典键。 */
export type BridgeKey = keyof typeof zh;
