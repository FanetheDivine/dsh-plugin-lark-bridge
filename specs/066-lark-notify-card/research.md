# Research: 通知正文卡片与上报正文色

## R-01 如何识别成功的 `lark_notify`

**Decision**: 前端精确匹配现有 `已发送给用户（N 条）` 与 `已回复给用户（N 条）` 两种单文本结果，只把匹配结果当作显示卡片的门槛。

**Rationale**: 工具失败也返回普通结果对象，仅凭 `isError` 不足以区分成功。现有成功文案由本插件固定生成，可以可靠排除失败结果。用户只要求展示正文，因此无需解析或展示回执内容。

**Alternatives considered**: 修改结果 render 为 JSON。会改变模型可见结果，超出纯 UI 范围。

## R-02 卡片正文来自哪里

**Decision**: 只读取 `tool/call.arguments.text`。成功结果存在但正文缺失或为空时不产卡片。

**Rationale**: 完整正文只存在于调用参数。历史窗口缺调用时无法恢复正文，空卡片没有价值，默认工具行已能表示这次调用。

**Alternatives considered**: 显示回执占位卡片。违反「只展示输出的文本」。

## R-03 节点生命周期

**Decision**: 新增独立 `lark-notify-result` Definition，匹配调用与成功结果，节点放在 `turn`，锚点为结果序号加 `0.5`。

**Rationale**: 与上报卡片一致，卡片不受过程分组折叠影响；调用补载后能重新解析正文。进行中与失败没有成功结果，因此保持默认工具行。

**Alternatives considered**: 重构上报节点为通用工厂。会扩大既有上报链路改动，没有必要。

## R-04 上报正文色

**Decision**: 把 `.dsh-lark-report` 的 `color` 从 `--dsw-alias-label-secondary` 改为 `--dsw-alias-label-primary`。

**Rationale**: 容器改色可让 Markdown 内部未单独指定颜色的节点继承正文色。正文、任务简介与附件名已使用主前景色，辅助层级保持不变。

**Alternatives considered**: 全部文字统一主前景色。会消除回执与路径的视觉层级，超出需求。

## R-05 验证方式

**Decision**: 单元测试覆盖事件、组件与 CSS，真实宿主覆盖成功/失败通知、颜色和折叠可见性。

**Rationale**: 宿主实际渲染只能由实机验证。提示词与在场机制不变，无需渠道行为实验。
