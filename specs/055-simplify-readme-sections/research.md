# Research: 精简 README 最后两节

## Decision 1: `README.md` 与 `docs/` 的信息归属核对

- **Decision**: 仅精简 `README.md` 的「关于调度会话」与「在场状态」两节，不修改 `docs/how-it-works.md` 或 `docs/known-risks.md`。
- **Rationale**:
  - 宪章原则 III 规定 `README.md` 面向插件用户，记录功能、安装、配置、工具，省略实现细节。
  - 从 `README.md` 移除的内部机制细节（`session_create` 工具及 `task_type` 参数、每轮结束自动上报、归档任务与归档会话区别、启动时在场状态初始值、时间选择器交互、到点去重与手动保持规则、节假日联网缓存与回退链、停用隐藏行为）均已在 `docs/how-it-works.md` 的「调度服务与预设叠加」、「被管理会话能力」、「任务会话模型」、「在场状态」各节中完整记录。
- **Alternatives Considered**:
  - 在 `README.md` 保留指向 `docs/how-it-works.md` 的细节说明：用户无需阅读内部实现文档，保持 `README.md` 简明。
