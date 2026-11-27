# Research: send_report 相对附件路径解析

**Date**: 2026-11-27 | **Plan**: [plan.md](./plan.md)

## R1 会话当前工作目录的来源

- **Decision**: 通过宿主 `workingDirectory` 服务的 `get(session)` 读取。
- **Rationale**: 该服务的投影以 `session.header.cwd` 初始化，再按 `working-directory/change` 事件更新，读取不触发文件系统访问；宿主自身的工作目录归档也这样取值。
- **Alternatives**:
  - `session.cwd`：宿主 `Session` 类没有该属性，取值恒为 `undefined`。
  - `session.header.cwd`：只是创建目录，会话切换目录后不更新。

## R2 切换工作目录的写入口

- **Decision**: 两种切换方式都通过 `workingDirectory.set` 写入 `working-directory/change`，解析链无需区分来源。
- **Rationale**: `working_directory` 工具调用 `ctx.workingDirectory.set(exec.agent, args.cd)`；`create_worktree` 建好 worktree 后调用 `workingDirectory.set(agent, path)`。
- **Alternatives**: 分别判断会话是否处在 worktree；无必要。

## R3 宿主版本与类型来源

- **Decision**: 用本地最小接口描述宿主服务，`ctx.get('workingDirectory')` 经一次显式断言读取。
- **Rationale**: 仓库已有 `SessionControllerLike`、`AgentsLike` 等本地最小接口，未把宿主服务包列为依赖；新增 `@deepseek-ai/dsh-working-directory` 会引入新依赖与 `minimumReleaseAgeExclude` 条目。
- **Alternatives**: 新增宿主包作为 devDependency 取得真实类型；代价是新增依赖，且仍然只能读到同一份接口。

## R4 回退链

- **Decision**: `workingDirectory` 投影 → `session.header.cwd` → 任务记录的 cwd → `process.cwd()`，最后一级记 `logger.warn`。
- **Rationale**: 前两级来自调用会话本身；任务 cwd 只在会话句柄缺失时兜底；进程目录只作为最后手段。
- **Alternatives**: 直接报错；会让旧会话无法上报。

## R5 校验失败的错误文本

- **Decision**: `send_report files must be existing .md files: <原始值> -> <绝对路径>; ... (base <基准目录>)`。
- **Rationale**: 原始值用于对照调用参数，绝对路径与基准目录让会话一次定位解析位置。
- **Alternatives**: 保持只报原始值；本缺陷的排查成本正来自这里。

## R6 测试夹具

- **Decision**: 会话夹具改为 `{ session: { id, header: { cwd } } }`，需要投影时通过 `makeCtx({ services: { workingDirectory: { get } } })` 注入。
- **Rationale**: 现有夹具写成 `{ session: { id, cwd } }`，与宿主结构不同，缺陷因此没有测试可见性。
- **Alternatives**: 保留旧夹具并额外断言；无法暴露真实结构差异。

## R7 文档归属

- **Decision**: 机制更新到 `docs/how-it-works.md` 的上报段落，变更记录写入 CHANGELOG。
- **Rationale**: `send_report` 的参数与投递机制归属该文档；README 没有 `send_report` 段落，无需改动。
- **Alternatives**: 在 README 加使用说明；超出本次缺陷修复范围。
