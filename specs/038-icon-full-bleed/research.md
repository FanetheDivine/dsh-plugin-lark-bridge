# 技术研究：插件图标铺满与元数据文案

宿主版本以仓库锁定的 `@deepseek-ai/*@0.2.2-rc.5` 为准；图标由宿主前端渲染，渲染代码读取本机安装的宿主包。

## R-001 宿主的图标渲染尺寸

**Decision**: 图标按 36 单位画布交付，图形在画布内自行铺满；底板与描边交给宿主。

**Rationale**: `dsh-client-ui-plugin-manager` 的样式与客户端代码显示：

- 卡片底板 `--card-icon-size: 48px`，行底板 40px，两者都带 `0.5px` 描边与圆角。
- 底板内的图片按 36px（卡片）与 30px（行）绘制，`object-fit: contain`。
- 宿主不解码 SVG 内部几何，只按图片尺寸绘制。

因此插件能控制的只有 SVG 画布内的图形占比。当前图形墨水盒为 18.05×14.35 单位，卡片中实际可见图形只有 50% 宽。

**Alternatives Considered**:

- 让宿主减小底板内边距：宿主代码，不可改。
- 输出 PNG：宿主同样按 36px/30px 绘制，尺寸问题不变，还引入位图。

## R-002 目标变换参数

**Decision**: 把 `<g>` 的变换改为 `translate(-4.77117 -3.94208) scale(2.7426524)`。

**Rationale**: 图形墨水盒（源坐标）为 x 1.73962–14.8656、y 2.78381–13.21682，宽 13.12598、高 10.43301，长宽比 1.25812。按宽度铺满画布：

- 缩放 `36 / 13.12598 = 2.7426524`。
- 水平位移 `-1.73962 × s = -4.77117`，使左边落在 0。
- 垂直位移 `(36 - 10.43301 × s) / 2 - 2.78381 × s = -3.94208`，使图形上下居中，上下各留 3.69294 单位。

结果墨水盒为 36×28.6141，左右溢出 0，上下留白对称。

**Alternatives Considered**:

- 非等比拉伸到 36×36：横向额外放大约 26%，用户选择等比。
- 把坐标烘焙进 `path` 的 `d`：文件更大，变换不可读。

## R-003 几何核对方式

**Decision**: 不新增几何断言。用一次性 Node 脚本解析 `path` 与 `<g transform>` 计算墨水盒，与实现时的 Chrome `getBBox` 结果互相核对。

**Rationale**: 用户决定不为本次静态资产变更增加测试（宪章 II 的偏离记录在 plan 的 Complexity Tracking）。核对方法覆盖真实几何：解析 `M`、`L`、`H`、`V`、`C`、`Z`，三次贝塞尔用导数求极值；本机实测与 Chrome `getBBox` 一致到 1e-4 量级。脚本不入库，结果写入实机验证报告。

**Alternatives Considered**:

- 在 `tests/support/svg-ink.ts` 建几何辅助并扩展 `tests/icon.test.ts`：用户选择不测试。
- 断言 `transform` 字符串：只复述常量。
- 用 playwright 渲染后测量：单元测试依赖本机 Chrome。

## R-004 元数据落点

**Decision**: 改 `locale/zh.json` 与 `locale/en.json` 的 `meta.title`、`meta.description`，同步 `package.json` 的 `description`。

**Rationale**: 宿主在插件停用状态也读取两份 locale 的 `meta`；`package.json` 的 `description` 是同字段的回落值，也是 npm 包页描述。`tests/metadata.test.ts` 只校验结构、键集、非空与标题单行，不需要修改。逐字文案由实机核对与 `npm pack --dry-run --json` 覆盖，避免写复述文案的测试。

**Alternatives Considered**:

- 在测试中断言中文与英文文案：违反宪章 II「测试不复述文案」。
- 新增第三种语言：用户没要求。

## R-005 CHANGELOG

**Decision**: 在 `CHANGELOG.md` 新增 `## Unreleased` 与 `### Changed` 条目。

**Rationale**: 先例见 035 的提交：分支自己写 `CHANGELOG.md`，`pnpm run release` 再把正文归档到 `changelogs/CHANGE.<version>.md`。`changelogs/` 下的文件由发布脚本生成，分支不直接编辑。

**Alternatives Considered**:

- 直接写 `changelogs/CHANGE.0.2.0.md`：该文件已归档 0.2.0，发布脚本会覆盖。

## R-006 实机验证

**Decision**: 用 `.dsh/skills/real-device-test` 的隔离 profile 验证图标与新文案。

**Rationale**: 该 skill 已提供 profile 搭建、GUI 启动与浏览器驱动，用 mock 模型避免真实模型调用；插件以链接方式装入，改完 `icon.svg` 与 locale 后只需刷新宿主可读取的静态文件。验证项：

- 插件页卡片与行中的图标截图，按像素测量图形墨水盒相对底板的占比。
- 中文与英文的标题、描述文本。
- 插件停用状态下的标题与描述。

**Alternatives Considered**:

- 直接装到用户现有 profile：会改动用户环境。
- 只看单元测试：图标渲染路径由宿主实现，单元测试无法覆盖。

## R-007 历史规格

**Decision**: 不改 `specs/030-bridge-presentation/research.md` 中关于 `translate(7 7) scale(1.375)` 的记录。

**Rationale**: spec 记录当时的决策与理由，属于历史档案；本次变更由 038 的 spec 与 plan 记录。README 与 `docs/` 不含图标几何描述，无需同步。

**Alternatives Considered**:

- 回写 030 的记录：会让历史决策与实际执行过程不一致。
