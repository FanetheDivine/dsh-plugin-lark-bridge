# Data Model: 工具参数声明的无损 JSON

## 实体

### 工具声明参数

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `type` | `'object'` | 根类型，固定 |
| `properties` | 对象 | `text` 必填字符串，`reply_to` 可选字符串；两者保留说明文本 |
| `required` | `['text']` | 必填字段列表 |
| `additionalProperties` | `false` | zod 生成的默认收敛 |
| `$schema` | 不存在 | 生成时剔除 |
| `~standard` | 不存在 | zod 添加的不可枚举键，生成时剔除 |

### 无损 JSON 值

宿主 `snapshotJsonValue` 接受的值集合：

| 类别 | 规则 |
| --- | --- |
| null / 布尔 | 直接接受 |
| 字符串 | 直接接受 |
| 数字 | 只接受有限值；拒绝 `NaN`、`Infinity`、`-0` |
| 数组 | 原生 `Array.prototype`，除 `length` 外只有连续下标 |
| 对象 | 原型为 `null` 或原生 `Object.prototype`；自有键全为可枚举字符串键 |
| 引用 | 沿路径不出现循环 |

### 校验结果

| 结果 | 形态 | 调用方处理 |
| --- | --- | --- |
| 通过 | 深拷贝，与输入结构相等但不存在引用共享 | 断言内容与原始声明一致 |
| 失败 | 抛出 `Error`，消息含失败路径 | 测试用 `toThrow` 断言路径 |

## 关系

- 每个已注册工具持有恰好一个 `parameters`，都是无损 JSON 值。
- 校验函数只读 `parameters`，不修改原始声明；返回的副本可自由改写。

## 状态与校验规则

1. 声明在注册时生成一次，之后只读。
2. 声明的键集合固定为 `type`、`properties`、`required`、`additionalProperties`。
3. 任一已注册工具的声明校验失败即视为缺陷，不区分工具来源。
