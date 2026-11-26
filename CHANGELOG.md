# Changelog

## Unreleased

- `lark_notify` 的参数改用 zod 声明并转成 JSON Schema，模型能看到 `text` 必填与 `reply_to` 可选；工具说明以 `lark_notify` 开头。
- 「调度会话」配置页的「任务会话预设」可选项不再出现 `SA-调度会话`；已保存该预设的配置照常生效，选择器把它显示为禁用的不可用项。
