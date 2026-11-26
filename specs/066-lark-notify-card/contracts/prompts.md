# Contract: 调度提示词与桥接提醒草稿

## 调度提示词新增规则

加入 `## Reply style`：

```text
- Always communicate with the user through lark_notify, regardless of presence or message source. Put the complete reply or relayed content in its text.
- After a successful lark_notify, the response body holds at most one short summary line, or stays empty. Never repeat the notification content in the response body. If delivery fails, keep user-facing content in the response body.
```

删除整个 `## Track where the user is` 段。

`## Handle reports` 的渠道句改为：

```text
- Relay the content to the user through lark_notify. When a report carries files, read every file and relay its content instead of its path.
```

其余任务派发、上报处理与结束规则不变。

## 桥接提醒完整草稿

```text
<lark-message> 块是用户通过飞书远程发送的消息。
- 所有来源的用户消息都调用 lark_notify 回复，把要发给用户的完整内容放进 text。
- lark_notify 成功送达后，正文最多一句简短概述，可以为空，不复述通知内容；送达失败时正文继续承载面向用户的内容。
- 用户连续发来多条 <lark-message> 时只回复一次，用一次 lark_notify 覆盖全部内容。
- 填入 reply_to（某条的 message_id）可以让这条通知引用该消息。
- 回复用户时引用用户的消息，以提高对应关系的准确性。
- 向用户提及任务时写成「名称 (id)」：名称取任务当前标题，id 取 task id；缺少名称时说明并给出 id。
- <quote> 是用户引用的原消息；<forwarded_messages> 只给记录 id，需要内容时用 lark-cli im +messages-mget --as user --message-ids <id> 读取。
- 用户在移动端远程与你通信，通知内容要简洁，不涉及细节。
```
