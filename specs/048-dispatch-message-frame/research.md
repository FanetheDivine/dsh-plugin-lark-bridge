# Research: 调度消息去掉 system-reminder 嵌套

## R-001 meta-tools `session_send` 的帧格式

**Decision**: 按 `<system-reminder>\n正文\n</system-reminder>` 精确匹配，正文已由 meta-tools 去首尾空白，内部 `</system-reminder>` 已转义为 `<\/system-reminder>`。

**Rationale**: `dsh-plugin-meta-tools@0.1.7` 的 `systemReminder()` 固定生成该格式，`session_send` 只投递一个文本块，`text` 参数先 `trim()`，非空才投递。

**Alternatives Considered**:

- 按正则提取任意位置的帧：会误改调度模型自己贴进正文的标签。

## R-002 剥离位置

**Decision**: 在 `src/sa-worker/dispatch-message.ts` 包装前剥离。

**Rationale**: 该来源的消息只在这里被读取；`sa-worker` 的 `agent/pre-step` 也只需拿到包装结果，剥离与包装同处一处便于一起测试。

**Alternatives Considered**:

- 在 meta-tools 侧改格式：不属于本插件，且会影响其他会话。
- 在 `agent/pre-step` 之后改表层事件：宿主已持久化，改动面更大。

## R-003 边界判定

**Decision**: 只有单个内容块、块类型为 text、`trim()` 后以 `<system-reminder>\n` 开头且以 `\n</system-reminder>` 结尾、内部不含 `<system-reminder>` 与 `</system-reminder>` 时才剥离。

**Rationale**: 满足退出条件的所有组合都只对应 meta-tools 生成的单一帧，其他情况保持原样，避免误改正文。

**Alternatives Considered**:

- 只判断开头结尾：正文中出现第二个帧时会被错误裁剪。

## R-004 转义还原

**Decision**: 剥离后把正文中的 `<\/system-reminder>` 还原为 `</system-reminder>`。

**Rationale**: meta-tools 写入时转义，是为了不提前闭合它自己的帧；帧被剥离后转义失去意义，还原后模型读到的是原文。

**Alternatives Considered**:

- 保持转义：模型看到 `<\/` 会误解为正文原本的写法。

## R-005 实机验证方式

**Decision**: 使用 `real-device-test` 技能，在隔离 `DSH_HOME` 与独立 profile 下装载插件，通过 mock 模型记录工作会话收到的用户消息文本。

**Rationale**: 该技能已定义不触碰用户 GUI 与 `~/.dsh` 的隔离流程，并已有记录请求的 mock 模型设施。

**Alternatives Considered**:

- 直接让用户在生产 profile 上观察：会污染用户会话记录。
