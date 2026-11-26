// 无损 JSON 校验的行为测试：覆盖宿主会拒绝的值与深拷贝语义。
import { describe, expect, it } from 'vitest';

import { assertLosslessJson } from './lossless-json.ts';

describe('assertLosslessJson', () => {
  it('接受纯 JSON 并返回深拷贝', () => {
    const value = { text: 'hello', nested: { list: [1, null, true] } };
    const copy = assertLosslessJson(value) as { text: string; nested: { list: unknown[] } };
    expect(copy).toEqual(value);
    copy.text = 'changed';
    copy.nested.list.push('extra');
    expect(value.text).toBe('hello');
    expect(value.nested.list).toHaveLength(3);
  });

  it('接受 null 与原型的空对象', () => {
    expect(assertLosslessJson(null)).toBeNull();
    const bare = Object.create(null) as Record<string, unknown>;
    bare['a'] = 1;
    expect(assertLosslessJson(bare)).toEqual({ a: 1 });
  });

  it('拒绝不可枚举键并指出键路径', () => {
    const value: Record<string, unknown> = { ok: true };
    Object.defineProperty(value, 'hidden', { value: 1, enumerable: false });
    expect(() => assertLosslessJson(value)).toThrow(/value\.hidden/);
  });

  it('拒绝 symbol 键', () => {
    const value: Record<PropertyKey, unknown> = { ok: true };
    value[Symbol('tag')] = 1;
    expect(() => assertLosslessJson(value)).toThrow(/Symbol\(tag\)/);
  });

  it('拒绝 -0、NaN 与 Infinity', () => {
    expect(() => assertLosslessJson(-0)).toThrow(/有限数字/);
    expect(() => assertLosslessJson({ n: Number.NaN })).toThrow(/value\.n/);
    expect(() => assertLosslessJson([Number.POSITIVE_INFINITY])).toThrow(/value\[0\]/);
  });

  it('拒绝类实例', () => {
    class Widget {
      readonly id = 'w1';
    }
    expect(() => assertLosslessJson({ widget: new Widget() })).toThrow(/value\.widget/);
  });

  it('拒绝稀疏数组与带额外键的数组', () => {
    // biome-ignore lint/suspicious/noSparseArray: 故意构造稀疏数组。
    const sparse = [1, , 3];
    expect(() => assertLosslessJson(sparse)).toThrow(/连续下标/);

    const extra = [1, 2] as unknown[] & { tag?: string };
    extra.tag = 'x';
    expect(() => assertLosslessJson(extra)).toThrow(/连续下标/);
  });

  it('拒绝循环引用并指出位置', () => {
    const value: Record<string, unknown> = { name: 'root' };
    value['self'] = value;
    expect(() => assertLosslessJson(value)).toThrow(/value\.self/);
  });

  it('同层重复引用不算循环', () => {
    const shared = { id: 1 };
    expect(assertLosslessJson({ a: shared, b: shared })).toEqual({ a: { id: 1 }, b: { id: 1 } });
  });
});
