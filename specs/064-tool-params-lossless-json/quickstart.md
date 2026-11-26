# Quickstart: 修复工具参数声明不是无损 JSON 导致的宿主崩溃

## 前置

1. `pnpm install`
2. 无需构建产物；`dist/` 不参与本特征验收

## 验证顺序

按 TDD 顺序执行，先看新测试失败，再修实现：

1. 写 `tests/support/lossless-json.ts` 与两个测试文件。
2. `pnpm test:code`：新增用例失败，失败信息指向 `parameters.~standard`。
3. 改 `src/tools.ts` 的 `parametersOf`。
4. `pnpm test:code`：全部通过。
5. `pnpm format && pnpm check`：通过。

## 断言点

- 校验函数对修复前的声明报错，消息含 `~standard`。
- 校验函数对纯 JSON 返回深拷贝，改写副本不影响原始声明。
- 校验函数拒绝 `-0`、`NaN`、类实例、稀疏数组与循环引用。
- `lark_notify` 的声明通过校验，且 `properties.text`、`properties.reply_to`、`required` 与现状一致。
- `lark_notify` 的声明不含 `$schema`。
- 三行插件的全部已注册工具声明都通过校验。
- 同一批声明连续校验 10 次，结果一致。

## 宿主等价性

校验规则抄自 `@deepseek-ai/dsh-tools@0.2.2-rc.5` 的 `snapshotJsonValue`，见 [research.md](./research.md) 的 R-01、R-05。宿主升级改变规则时，先复核该函数再改校验。

## 可选复核

`pnpm full-check` 额外验证构建与 `test:dist`，PR 前可跑一次，不属本特征验收。
