// 无损 JSON 校验：按宿主 `@deepseek-ai/dsh-tools` 的 `snapshotJsonValue` 规则递归检查，通过时返回深拷贝。
// 声明无法被宿主克隆时，宿主会抛出致命异常，因此测试必须用同一套判定先发现越界写法。

/** 校验失败。 */
function reject(path: string, reason: string): never {
  throw new Error(`${path} ${reason}`);
}

/** 判断值是否为纯对象：原型为 `null` 或原生 `Object.prototype`。 */
function isPlainObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

/** 递归复制一个无损 JSON 值；失败时抛错，消息含失败路径。 */
function clone(value: unknown, path: string, ancestors: Set<object>): unknown {
  if (value === null) return null;
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return value;
  if (type === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      reject(path, '必须是有限数字，且不能是 -0');
    }
    return value;
  }
  if (type !== 'object') reject(path, '必须是 JSON 值：对象、数组、字符串、数字、布尔或 null');
  const record = value as object;
  if (ancestors.has(record)) reject(path, '不能包含循环引用');
  ancestors.add(record);
  try {
    if (Array.isArray(record)) {
      if (Object.getPrototypeOf(record) !== Array.prototype) reject(path, '必须是原生数组');
      if (Reflect.ownKeys(record).length !== record.length + 1) {
        reject(path, '只能有连续下标键');
      }
      const copy: unknown[] = [];
      for (let index = 0; index < record.length; index++) {
        if (!Object.hasOwn(record, index)) reject(`${path}[${index}]`, '不能是稀疏数组');
        copy[index] = clone((record as unknown[])[index], `${path}[${index}]`, ancestors);
      }
      return copy;
    }
    if (!isPlainObject(record)) reject(path, '必须是纯对象');
    const copy: Record<string, unknown> = {};
    for (const key of Reflect.ownKeys(record)) {
      if (typeof key !== 'string' || !Object.prototype.propertyIsEnumerable.call(record, key)) {
        reject(`${path}.${String(key)}`, '键必须是可枚举字符串键');
      }
      copy[key] = clone((record as Record<string, unknown>)[key], `${path}.${key}`, ancestors);
    }
    return copy;
  } finally {
    ancestors.delete(record);
  }
}

/**
 * 按宿主规则校验一个值是无损 JSON，并返回深拷贝。
 * @param value - 待校验的值，通常是工具声明的 `parameters`。
 * @param path - 失败消息中的起始路径，默认 `value`。
 * @returns 与输入结构相等的深拷贝。
 */
export function assertLosslessJson(value: unknown, path = 'value'): unknown {
  return clone(value, path, new Set());
}
