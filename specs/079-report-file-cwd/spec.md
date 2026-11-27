# Feature Specification: send_report 相对附件路径解析

**Feature Branch**: `fix/079-report-file-cwd`

**Created**: 2026-11-27

**Status**: Approved

**变更类别**: 缺陷修复

**Input**: User description: "session-8764fc17-1451-4fdc-87bd-9f41350636bc 调用 send_report 报错"

## Open Decisions

<!--
Status values:
- Draft: the current full document is not approved or waived.
- Approved: the user approved the current full document.
- Waived: the user waived the review and accepted the recorded risks.
Record each undecided question with a stable id and its dependencies.
-->

None.

## Clarifications

### Session 2026-11-27

- [D-001] Q: 相对 `files` 的基准目录取会话当前工作目录，还是会话创建时的项目目录？ -> A: 会话当前工作目录。宿主 `workingDirectory` 服务记录的目录随会话切换更新，`create_worktree` 与 `working_directory` 两个工具都通过 `workingDirectory.set` 写入该值。
- [D-002] Q: 宿主没有记录会话当前工作目录时，基准目录按什么顺序回退？ -> A: 依次回退到会话创建目录、任务记录的 cwd，再回退到进程当前目录并记一条警告。
- [D-003] Q: 附件校验失败的错误文本是否给出解析后的绝对路径？ -> A: 给出，格式为「原始值 -> 解析后的绝对路径」。
- [D-004] Q: 是否同批统一任务记录 cwd 的读取方式？ -> A: 统一，任务记录 cwd 与附件校验使用同一份会话工作目录。

## Review Record

- 2026-11-27 | Decision: Approved | Scope: current full document | Open items: none | Risks: none

## 缺陷背景

- 现象：被管理会话 `session-8764fc17-1451-4fdc-87bd-9f41350636bc` 连续三次调用 `send_report` 携带相对路径附件失败，错误为 `send_report files must be existing .md files: <原始值>`；改用绝对路径后成功。
- 已排除：附件文件存在；扩展名为 `.md`；会话对文件有读写权限。
- 现有实现按会话对象上不存在的属性读取工作目录，取值恒为空后回退到宿主进程的启动目录，相对路径因此解析到与调用会话无关的目录。
- 会话真实工作目录由宿主 `workingDirectory` 服务记录：`create_worktree` 与 `working_directory` 都通过 `workingDirectory.set` 追加 `working-directory/change` 事件，读取端按事件投影取值。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 相对路径附件可用 (Priority: P1)

被管理会话在报告里附上规格文档、结论文档等 Markdown 文件，路径写成相对当前工作目录的形式，上报正常投递，附件随报告存档。

**Why this priority**: 相对路径是会话写文件的自然形式，也是工具描述对外承诺的写法；该路径不通时，会话只能反复试错或放弃附件。

**Independent Test**: 用宿主真实的会话结构构造一个被管理会话，其当前工作目录下放一份 `.md` 文件，调用 `send_report` 只给相对路径，校验通过并把文件复制到报告存档目录。

**Acceptance Scenarios**:

1. **Given** 被管理会话的当前工作目录下存在 `specs/demo/spec.md`，**When** 会话调用 `send_report` 携带 `files: ["specs/demo/spec.md"]`，**Then** 上报存档成功，存档目录出现该文件的副本。
2. **Given** 同一会话改用绝对路径，**When** 调用 `send_report`，**Then** 结果与相对路径一致。

---

### User Story 2 - 切换工作目录后仍能上报附件 (Priority: P2)

会话在对话中把工作目录切换到子目录或 worktree，之后用相对新目录的路径上报附件，解析按切换后的目录进行。

**Why this priority**: 派发任务常要求会话在独立 worktree 中工作，规格与报告都写在该 worktree；按创建目录解析仍会失败。

**Independent Test**: 构造一个创建目录为 A、当前工作目录为 B 的会话，在 B 下放文件，用相对路径上报，校验通过。

**Acceptance Scenarios**:

1. **Given** 会话创建目录为 A、当前工作目录为 B，且 B 下存在 `specs/demo/spec.md`，**When** 会话用相对路径上报该文件，**Then** 解析到 B 下的文件并通过校验。
2. **Given** 同一会话把工作目录切回 A，**When** 再次用相对路径上报，**Then** 解析到 A 下的同名路径。

---

### User Story 3 - 失败原因可定位 (Priority: P3)

附件校验失败时，错误文本直接说明每个无效项解析到了哪个绝对路径，会话据此改写路径即可，无需试错。

**Why this priority**: 该缺陷的排查成本来自错误文本只给原始值。

**Independent Test**: 上报一个不存在的相对路径，断言错误文本包含原始值与解析后的绝对路径。

**Acceptance Scenarios**:

1. **Given** 会话当前工作目录为 B，**When** 上报不存在的相对路径 `nope.md`，**Then** 错误文本包含 `nope.md` 与 B 下的绝对路径。

---

### Edge Cases

- 相对路径指向目录或非 `.md` 文件时，仍按无效项报错，并给出解析后的绝对路径。
- 当前工作目录在本次调用前被删除时，宿主回退到会话创建目录，解析与报错都基于回退后的目录。
- 会话未被调度会话管理时，先完成附件校验再报告未管理，错误类型保持不变。
- `files` 省略或为空时，行为与当前一致。
- 路径含空格或中文字符时按字面解析，不做转义。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `send_report` 的 `files` 元素为相对路径时 MUST 按调用会话的当前工作目录解析。
- **FR-002**: 会话在本轮之前切换过工作目录时，相对路径 MUST 按切换后的目录解析，`create_worktree` 与 `working_directory` 两种切换方式同等生效。
- **FR-003**: 基准目录 MUST 读取宿主 `workingDirectory` 服务记录的会话当前工作目录；该值不可用时 MUST 依次回退到会话创建目录、任务记录的 cwd、进程当前目录，回退到进程当前目录时 MUST 记一条警告。
- **FR-004**: 附件校验失败的错误 MUST 给出每个无效项的原始值与解析后的绝对路径，格式为 `原始值 -> 绝对路径`。
- **FR-005**: 任务记录中的 cwd 与附件校验 MUST 使用同一份会话工作目录，手动 `session_manage` 建任务时同样生效，两处结果一致。
- **FR-006**: 绝对路径 MUST 保持当前行为，直接按给定值校验与复制。
- **FR-007**: 上报存档、投递与附件复制 MUST 保持当前行为，只有路径解析改变。

### Key Entities

- **调用会话（caller session）**: 发起 `send_report` 的会话，提供工作目录；包含创建目录与当前工作目录两个值。
- **上报附件（files 项）**: 上报携带的 Markdown 文件路径，可为绝对路径或相对路径，校验通过后复制进报告存档目录。
- **任务记录（task）**: 调度工作区中的任务状态，记录会话 id 与其 cwd。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 单元测试以宿主真实的会话结构构造被管理会话，相对路径附件通过校验并出现在存档目录；当前实现下该测试失败。
- **SC-002**: 单元测试覆盖「创建目录与当前工作目录不同」的场景，附件按当前工作目录解析。
- **SC-003**: 单元测试断言校验失败的错误文本同时包含原始值与解析后的绝对路径。
- **SC-004**: `pnpm check` 通过，`pnpm test:code` 无失败用例。

## Assumptions

- 宿主版本为 `@deepseek-ai/dsh` `0.2.2-rc.5`。
- 该版本的会话对象通过 `session.header.cwd` 暴露创建目录；`session.header.cwd` 在会话生命周期内不变。
- 该版本的会话对象没有 `session.cwd` 属性，现有实现因此恒为空。
- 当前工作目录由 `workingDirectory` 服务记录：状态以 `session.header.cwd` 初始化，再按 `working-directory/change` 事件更新；读取端 `workingDirectory.get(session)` 不触发文件系统访问。
- 已在本机会话中确认：切换工作目录后会话日志出现 `working-directory/change`，取值与切换目标一致。
- 相对路径的语义与工具描述一致，只覆盖 `files`；`text`、`desc` 不含路径。
