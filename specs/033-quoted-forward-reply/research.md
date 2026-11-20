# Research: 引用与聊天记录呈现、精确回复

## 事件是否携带被引正文

**Decision**: 不携带。按 `reply_to` 用 `im +messages-mget` 读取。

**Rationale**: `im.message.receive_v1` 的输出字段只有 `content`（本条正文）、`reply_to`、`root_id`、`thread_id` 与发送者信息；被引消息正文不在事件内。lark-cli 的转换层只预渲染本条内容。

**Alternatives considered**:
- 依赖客户端展示的引用框：模型看不到。
- 从会话历史推断被引消息：用户可能引用很久以前或未注入过的消息。

## 读取命令与身份

**Decision**: `lark-cli im +messages-mget --no-reactions --as user|bot --message-ids <id>`；user 优先，bot 兜底。

**Rationale**: `--no-reactions` 省一次附带查询；user 身份能读到 bot 受限的历史消息，bot 作为兜底免登录场景。命令输出 `{ok, identity, data:{messages}}`，`unwrapJson` 后得到 `{messages}`。

**Alternatives considered**:
- `im messages get` 原生接口：接口只支持单个 ID，且输出未做可读渲染。
- `+chat-messages-list` 定位：需要额外翻页与匹配，慢。

## mget 返回的字段

**Decision**: 读取 `message_id`、`msg_type`、`content`、`create_time`、`sender.sender_type` 与 `deleted`。

**Rationale**: `create_time` 是 `YYYY-MM-DD HH:mm` 字符串，`formatTime` 可直接解析；`sender.sender_type` 为 `user` 或 `bot`，用于 `from` 属性；`deleted` 为 true 时正文不可用。`msg_type` 与事件的 `message_type` 是同一枚举。

**Alternatives considered**:
- 用 `sender.name` 作为 `from`：名字不固定，模型难以稳定判断是用户还是机器人。

## 聊天记录正文

**Decision**: `message_type === 'merge_forward'` 时忽略 `content`，输出 `<forwarded_messages message_id="om_…"/>`。

**Rationale**: 官方文档说明合并转发消息的正文是固定占位，子消息需要按 ID 另行读取；事件与 mget 的正文都不是可用内容。

**Alternatives considered**:
- 预取子消息：用户只需 ID，展开会放大注入体积并引入额外失败路径。

## 超时与失败

**Decision**: 单次读取 8 秒超时；两次身份都失败时降级为只含 ID 与失败说明的 `<quote>`。

**Rationale**: `LarkCli.json` 已支持 `timeoutMs`（`RunOptions`），超时抛 `CliError('timeout')`，可直接被捕获。引用是补充信息，不能阻塞本条消息注入。

**Alternatives considered**:
- 长超时重试：用户正等待回复，延迟就是体验损失。

## 通知回复调用

**Decision**: 首段执行 `im +messages-reply --as bot --message-id <id> --text - --idempotency-key <key>`；后续段继续 `+messages-send`。

**Rationale**: `+messages-reply` 的文法与 `+messages-send` 一致，正文通过 stdin 传递；幂等键上限 50 字符，沿用现有 `lark-notify-<uuid>-<index>` 方案。回复目标由消息自身决定，不需要 `--user-id`。

**Alternatives considered**:
- 全部段都用回复：飞书中会产生多条引用链接。
- 用原生 `im messages reply`：缺少统一的可读输出与参数校验。