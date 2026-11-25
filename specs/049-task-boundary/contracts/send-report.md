# Contract: send_report

## 参数

```json
{
  "kind": "progress | question | completed | abandoned",
  "text": "string, optional",
  "files": ["string, optional"]
}
```

- `kind` 必填，取值之外报参数错误，不存档也不投递。
- `text` 与 `files` 至少提供一项，规则不变。

## 返回

不变：`{ reportId, taskId, delivered: true, warning? }`。

## 投递块

```xml
<work_session_message sessionid="<sessionId>" reportid="<reportId>" taskid="<taskId>" kind="<kind>">
<text>
<report text>
</text>
<files>
<absolute copied-file paths, one per line>
</files>
</work_session_message>
```

## 存档 front matter

```yaml
---
reportId: "<reportId>"
sessionId: "<sessionId>"
taskId: "<taskId>" | null
kind: "<kind>"
time: "<ISO time>"
files: []
---
```
