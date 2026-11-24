# Research

## R-001 README 的展示位置

**Decision**: README 正文不放相对链接。

**Rationale**: DSH Plugin Manager 把 README 作为插件详情页，并把相对链接渲染为纯文本。`docs/` 不进 npm 包。

**Alternatives Considered**: GitHub 公网链接。按 spec D-006 不链接 `docs/`。

## R-002 界面名称

**Decision**: 主行写作「用飞书和DSH对话」；插件管理页写作「插件」页；配置字段写作「预设」。

**Rationale**:

- 主行中文标题取自 `locale/zh.json` 的 `meta.title`。
- 「插件」取自 `@deepseek-ai/dsh-client-ui-plugin-manager` 中文字典的 `panel` 与 `title`。
- 「预设」取自 `src/client/locales.ts` 的 `config.sessionPreset.label`。

**Alternatives Considered**: 沿用 `Plugins 页`。它与中文界面不一致。

## R-003 迁移落点

**Decision**: 未覆盖信息迁入 `docs/how-it-works.md` 的现有章节，归属见 [data-model.md](./data-model.md)。

**Rationale**: spec D-002 指定该文件。按现有章节追加，避免新增结构。

**Alternatives Considered**: 飞书开放平台步骤放 `docs/known-risks.md`。该文件只写风险后果，配置步骤属于机制说明。

## R-004 依赖 README 锚点的引用

**Decision**: 把 `docs/how-it-works.md` 的 `README.md#前置` 改为 `README.md#使用`，并更新 `AGENTS.md` 文档索引的描述。

**Rationale**: 新 README 没有「前置」标题。宪章 III 要求冲突时同步修正其他文档。

**Alternatives Considered**: 无。

## R-005 测试影响

**Decision**: 无需新增或修改测试。

**Rationale**: 测试只校验 `README.md` 进包，不读取其内容。本次不改代码。
