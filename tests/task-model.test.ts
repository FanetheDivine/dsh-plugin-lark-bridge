// 工作会话模型配置读取测试。
import { describe, expect, it } from 'vitest';

import { readWorkerModel } from '../src/lark-super-agent/worker-model.ts';
import { volatile } from './helpers.ts';

describe('readWorkerModel', () => {
  it('provider 与模型成对时带上 effort，并读取热重载引用', () => {
    const effort = volatile('high');
    const config = {
      workerProvider: volatile('deepseek'),
      workerModel: volatile(' deepseek-chat '),
      workerEffort: effort,
    };
    expect(readWorkerModel(config)).toEqual({
      provider: 'deepseek',
      model: 'deepseek-chat',
      reasoningEffort: 'high',
    });
    effort.set('');
    expect(readWorkerModel(config)).toEqual({ provider: 'deepseek', model: 'deepseek-chat' });
  });

  it('未配置或半组配置按未配置处理，effort 不单独生效', () => {
    expect(readWorkerModel(undefined)).toBeUndefined();
    expect(readWorkerModel({ workerProvider: 'deepseek' })).toBeUndefined();
    expect(readWorkerModel({ workerModel: 'm', workerEffort: 'high' })).toBeUndefined();
  });
});
