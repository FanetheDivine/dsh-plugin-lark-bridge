# Tasks: 飞书机器人消息桥

**Input**: [spec.md](./spec.md) · [plan.md](./plan.md)

## Phase 1: 模板转化与配置骨架

- [x] T001 重命名包、插件行与构建 id 为 `dsh-plugin-lark-bridge`
- [x] T002 更新 `AGENTS.md`、宪章标题与模板说明，删除模板相关约定
- [x] T003 删除 `demo_echo`、示例事件、示例行与示例配置页
- [x] T004 实现 `src/config.ts` 与 `src/constants.ts`（工作区、标题、档案名、CLI 覆盖、ownerOpenId、启动检查）
- [x] T005 实现 `src/state.ts`（原子读写、串行队列、去重窗口淘汰）与测试
- [x] T006 更新 `cordis.patch.yml`、`package.json`、`locale/*.json`、`README.md` 骨架
- [x] T007 阶段提交

## Phase 2: lark-cli 适配与鉴权

- [x] T008 实现 `src/cli.ts`：解析 `@larksuite/cli` 包内可执行文件、回退 `scripts/run.js`、统一 JSON 解包、超时与 stderr
- [x] T009 实现 `src/auth.ts` 阶段检测：cli、app、bot、user、ready
- [x] T010 实现 `profile add` 应用绑定（Secret 经 stdin）与 `auth status --verify`
- [x] T011 实现设备码授权：`auth login --no-wait --json`、链接解析、后台 `--device-code` 完成、取消
- [x] T012 覆盖 cli 与 auth 的单元测试（含 Secret 不入日志）
- [x] T013 阶段提交

## Phase 3: 会话桥接与通知工具

- [x] T014 实现 `src/sessions.ts`：工作区校验、创建/恢复、标题、挂载、置顶、持久化
- [x] T015 实现 `src/bridge.ts`：事件子进程、NDJSON、过滤、去重、reminder、重启退避、卸载清理
- [x] T016 实现 `src/tools.ts`：`lark_notify` 参数校验、分段、bot 身份发送、失败返回
- [x] T017 接好 `src/index.ts`：配置热重载、启动鉴权、工具注册、生命周期
- [x] T018 覆盖 sessions、bridge、tools 测试
- [x] T019 阶段提交

## Phase 4: 宿主 JSON 路由

- [x] T020 实现 `src/routes.ts`：状态、重新检测、绑定应用、开始/取消授权、重置会话
- [x] T021 同源校验、请求体上限、错误映射与测试
- [x] T022 阶段提交

## Phase 5: 浏览器鉴权弹窗与配置页

- [x] T023 实现 `src/client/api.ts` 与状态类型
- [x] T024 实现 `src/client/auth-overlay.tsx`：未就绪弹窗、关闭本次提示、入口跳转
- [x] T025 实现 `src/client/auth-panel.tsx` 与 `config-page.tsx`：状态、App ID/Secret、绑定、授权、重新检测
- [x] T026 更新 `src/client/locales.ts` 中英文案与配置字典
- [x] T027 更新客户端测试与 `client-bundle.test.ts`
- [x] T028 阶段提交

## Phase 6: 文档、发布设置与验收

- [x] T029 更新 `README.md`、`docs/how-it-works.md`、`docs/known-risks.md`、`CHANGELOG.md`
- [x] T030 恢复 CI tag 发布条件，版本设为 `0.1.0`，清理模板 spec
- [x] T031 运行 `pnpm format && pnpm check && pnpm build`
- [x] T032 在 Desktop profile 安装并对真实 lark-cli 验证鉴权、收发与会话
- [x] T033 阶段提交