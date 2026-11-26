// 任务会话模型、默认任务类型与预设配置读取测试。
import { describe, expect, it } from 'vitest';

import {
  readDefaultTaskType,
  readTaskModel,
  readTaskPreset,
} from '../src/lark-super-agent/task-model.ts';
import { volatile } from './helpers.ts';

describe('readDefaultTaskType', () => {
  it('默认或非 complex 时返回 common，配置为 complex 时返回 complex', () => {
    expect(readDefaultTaskType(undefined)).toBe('common');
    expect(readDefaultTaskType({})).toBe('common');
    expect(readDefaultTaskType({ defaultTaskType: 'common' })).toBe('common');
    expect(readDefaultTaskType({ defaultTaskType: 'invalid' })).toBe('common');
    expect(readDefaultTaskType({ defaultTaskType: 123 })).toBe('common');
    const type = volatile('complex');
    expect(readDefaultTaskType({ defaultTaskType: type })).toBe('complex');
    type.set('common');
    expect(readDefaultTaskType({ defaultTaskType: type })).toBe('common');
  });
});

describe('readTaskModel', () => {
  it('按给定或默认任务类型读取对应模型三元组与热重载引用', () => {
    const commonEffort = volatile('low');
    const complexEffort = volatile('high');
    const defaultType = volatile('common');
    const config = {
      commonTaskProvider: volatile('deepseek'),
      commonTaskModel: volatile(' deepseek-chat '),
      commonTaskEffort: commonEffort,
      complexTaskProvider: volatile('anthropic'),
      complexTaskModel: volatile(' claude-opus '),
      complexTaskEffort: complexEffort,
      defaultTaskType: defaultType,
    };
    expect(readTaskModel(config)).toEqual({
      provider: 'deepseek',
      model: 'deepseek-chat',
      reasoningEffort: 'low',
    });
    expect(readTaskModel(config, 'common')).toEqual({
      provider: 'deepseek',
      model: 'deepseek-chat',
      reasoningEffort: 'low',
    });
    expect(readTaskModel(config, 'complex')).toEqual({
      provider: 'anthropic',
      model: 'claude-opus',
      reasoningEffort: 'high',
    });

    defaultType.set('complex');
    expect(readTaskModel(config)).toEqual({
      provider: 'anthropic',
      model: 'claude-opus',
      reasoningEffort: 'high',
    });

    commonEffort.set('');
    expect(readTaskModel(config, 'common')).toEqual({
      provider: 'deepseek',
      model: 'deepseek-chat',
    });
  });

  it('所选任务类型未配置时不回退到另一任务类型，直接返回 undefined', () => {
    const config = {
      commonTaskProvider: 'deepseek',
      commonTaskModel: 'deepseek-chat',
    };
    expect(readTaskModel(config, 'common')).toEqual({
      provider: 'deepseek',
      model: 'deepseek-chat',
    });
    expect(readTaskModel(config, 'complex')).toBeUndefined();
  });

  it('未配置或半组配置按未配置处理，effort 不单独生效', () => {
    expect(readTaskModel(undefined)).toBeUndefined();
    expect(readTaskModel({ commonTaskProvider: 'deepseek' })).toBeUndefined();
    expect(readTaskModel({ commonTaskModel: 'm', commonTaskEffort: 'high' })).toBeUndefined();
    expect(readTaskModel({ commonTaskProvider: '   ', commonTaskModel: 'm' })).toBeUndefined();
    expect(
      readTaskModel({ complexTaskProvider: 'deepseek', defaultTaskType: 'complex' }),
    ).toBeUndefined();
  });

  it('非字符串字段按未配置处理', () => {
    expect(readTaskModel({ commonTaskProvider: 1, commonTaskModel: 'm' })).toBeUndefined();
    expect(
      readTaskModel({ commonTaskProvider: 'deepseek', commonTaskModel: null }),
    ).toBeUndefined();
    expect(readTaskModel('deepseek')).toBeUndefined();
  });
});

describe('readTaskPreset', () => {
  it('读取 taskPreset 的实时值并去掉两侧空白', () => {
    const preset = volatile(' task-session ');
    expect(readTaskPreset({ taskPreset: preset })).toBe('task-session');
    preset.set('');
    expect(readTaskPreset({ taskPreset: preset })).toBe('');
  });

  it('未配置或非字符串时返回空串', () => {
    expect(readTaskPreset(undefined)).toBe('');
    expect(readTaskPreset({})).toBe('');
    expect(readTaskPreset({ taskPreset: 42 })).toBe('');
  });
});
