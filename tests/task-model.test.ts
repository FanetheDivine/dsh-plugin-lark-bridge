// 任务会话模型与预设配置读取测试。
import { describe, expect, it } from 'vitest';

import { readTaskModel, readTaskPreset } from '../src/lark-super-agent/task-model.ts';
import { volatile } from './helpers.ts';

describe('readTaskModel', () => {
  it('provider 与模型成对时带上 effort，并读取热重载引用', () => {
    const effort = volatile('high');
    const config = {
      taskProvider: volatile('deepseek'),
      taskModel: volatile(' deepseek-chat '),
      taskEffort: effort,
    };
    expect(readTaskModel(config)).toEqual({
      provider: 'deepseek',
      model: 'deepseek-chat',
      reasoningEffort: 'high',
    });
    effort.set('');
    expect(readTaskModel(config)).toEqual({ provider: 'deepseek', model: 'deepseek-chat' });
  });

  it('未配置或半组配置按未配置处理，effort 不单独生效', () => {
    expect(readTaskModel(undefined)).toBeUndefined();
    expect(readTaskModel({ taskProvider: 'deepseek' })).toBeUndefined();
    expect(readTaskModel({ taskModel: 'm', taskEffort: 'high' })).toBeUndefined();
    expect(readTaskModel({ taskProvider: '   ', taskModel: 'm' })).toBeUndefined();
  });

  it('非字符串字段按未配置处理', () => {
    expect(readTaskModel({ taskProvider: 1, taskModel: 'm' })).toBeUndefined();
    expect(readTaskModel({ taskProvider: 'deepseek', taskModel: null })).toBeUndefined();
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
