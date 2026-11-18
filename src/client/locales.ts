/** 前端字典与命名空间。中文字典是键集事实源。 */

/** 前端使用的字典命名空间，与插件名一致。 */
export const NS = 'dsh-plugin-lark-bridge';

/** 中文字典。 */
export const zh = {
  'auth.title': '飞书机器人尚未就绪',
  'auth.description': '完成鉴权后，插件才能接收飞书消息并以机器人身份回复。',
  'auth.close': '本次不再提示',
  'auth.openSettings': '打开设置',
  'auth.retry': '重新检测',
  'auth.checking': '检测中…',
  'auth.ready': '飞书机器人已就绪',
  'auth.readyAccount': '授权用户：{name}',
  'auth.bindError': '绑定失败：{message}',
  'auth.actionError': '操作失败：{message}',
  'auth.stage.cli-missing': '缺少 lark-cli',
  'auth.stage.cli-missing.hint': '插件依赖 @larksuite/cli。重新安装插件或检查网络后重试。',
  'auth.stage.app-missing': '缺少应用凭据',
  'auth.stage.app-missing.hint': '在开放平台创建自建应用，然后在下方填写 App ID 与 App Secret。',
  'auth.stage.bot-unavailable': '机器人身份不可用',
  'auth.stage.bot-unavailable.hint':
    '检查 App ID/Secret 是否属于同一应用，以及应用是否启用了机器人能力。',
  'auth.stage.user-missing': '等待用户授权',
  'auth.stage.user-missing.hint': '点击开始授权，在浏览器完成飞书登录。',
  'auth.stage.ready': '已就绪',
  'auth.stage.ready.hint': '机器人可以接收飞书私聊，并向你发送通知。',
  'auth.appId': 'App ID',
  'auth.appSecret': 'App Secret',
  'auth.appSecretHint': '只写入 lark-cli 的专用配置，不保存到插件配置。',
  'auth.bind': '绑定应用',
  'auth.binding': '绑定中…',
  'auth.startLogin': '开始授权',
  'auth.starting': '启动授权…',
  'auth.openLink': '打开授权链接',
  'auth.waiting': '等待浏览器授权完成…',
  'auth.cancel': '取消授权',
  'auth.detail': '详情：{detail}',
  'auth.profile': '配置档案：{profile}',
  'config.summary': '工作区、会话标题与飞书鉴权',
  'config.section.auth': '鉴权',
  'config.section.session': '会话',
  'config.workspaceRoot.title': '工作区',
  'config.workspaceRoot.description':
    '飞书消息注入到这个目录对应的 DSH 会话；必须是已存在的绝对路径。',
  'config.workspaceRoot.invalid': '请填写已存在的目录绝对路径。',
  'config.sessionTitle.title': '会话标题',
  'config.sessionTitle.description': '桥接会话显示的名称；修改后下一个消息会同步到会话。',
  'config.sessionTitle.invalid': '标题不能为空。',
  'config.profile.title': 'lark-cli 档案名',
  'config.profile.description': '插件使用独立档案，不影响你现有的 lark-cli 登录。',
  'config.profile.invalid': '只能包含字母、数字、点、下划线与短横线。',
  'config.larkCli.title': 'lark-cli 路径',
  'config.larkCli.description': '留空自动使用插件依赖的 @larksuite/cli。',
  'config.ownerOpenId.title': '用户 open_id',
  'config.ownerOpenId.description': '留空使用授权结果；填写后跳过用户授权检查。',
  'config.ownerOpenId.invalid': 'open_id 必须以 ou_ 开头。',
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
  'auth.title': 'Lark bot is not ready',
  'auth.description':
    'Finish authentication before the plugin can receive messages and reply as the bot.',
  'auth.close': 'Not now',
  'auth.openSettings': 'Open settings',
  'auth.retry': 'Check again',
  'auth.checking': 'Checking…',
  'auth.ready': 'Lark bot is ready',
  'auth.readyAccount': 'Authorized user: {name}',
  'auth.bindError': 'Could not bind the app: {message}',
  'auth.actionError': 'Action failed: {message}',
  'auth.stage.cli-missing': 'lark-cli is missing',
  'auth.stage.cli-missing.hint':
    'The plugin depends on @larksuite/cli. Reinstall the plugin or check the network, then retry.',
  'auth.stage.app-missing': 'App credentials are missing',
  'auth.stage.app-missing.hint':
    'Create a custom app in the Lark console, then enter its App ID and App Secret below.',
  'auth.stage.bot-unavailable': 'Bot identity is unavailable',
  'auth.stage.bot-unavailable.hint':
    'Check that the App ID and secret belong to the same app and that bot capability is enabled.',
  'auth.stage.user-missing': 'Waiting for user authorization',
  'auth.stage.user-missing.hint':
    'Start authorization and complete the Lark sign-in in your browser.',
  'auth.stage.ready': 'Ready',
  'auth.stage.ready.hint': 'The bot can receive Lark direct messages and send you notifications.',
  'auth.appId': 'App ID',
  'auth.appSecret': 'App Secret',
  'auth.appSecretHint':
    'Written only to the dedicated lark-cli profile, never to plugin configuration.',
  'auth.bind': 'Bind app',
  'auth.binding': 'Binding…',
  'auth.startLogin': 'Start authorization',
  'auth.starting': 'Starting…',
  'auth.openLink': 'Open authorization link',
  'auth.waiting': 'Waiting for the browser authorization…',
  'auth.cancel': 'Cancel authorization',
  'auth.detail': 'Details: {detail}',
  'auth.profile': 'Profile: {profile}',
  'config.summary': 'Workspace, session title, and Lark authentication',
  'config.section.auth': 'Authentication',
  'config.section.session': 'Session',
  'config.workspaceRoot.title': 'Workspace',
  'config.workspaceRoot.description':
    'Lark messages are injected into the DSH session for this directory; it must be an existing absolute path.',
  'config.workspaceRoot.invalid': 'Enter an existing absolute directory path.',
  'config.sessionTitle.title': 'Session title',
  'config.sessionTitle.description':
    'The bridge session name; changes apply with the next message.',
  'config.sessionTitle.invalid': 'The title must not be empty.',
  'config.profile.title': 'lark-cli profile',
  'config.profile.description':
    'The plugin uses its own profile and leaves your existing lark-cli login untouched.',
  'config.profile.invalid': 'Use letters, digits, dots, underscores, and hyphens only.',
  'config.larkCli.title': 'lark-cli path',
  'config.larkCli.description': 'Leave empty to use the bundled @larksuite/cli dependency.',
  'config.ownerOpenId.title': 'User open_id',
  'config.ownerOpenId.description':
    'Leave empty to use the authorization result; setting it skips the user-auth check.',
  'config.ownerOpenId.invalid': 'The open_id must start with ou_.',
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
