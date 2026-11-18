// pack-report 单测：覆盖 npm 11 的数组输出与 npm 12 的对象输出。
import { describe, expect, it } from 'vitest';
import { packedFiles } from '../scripts/pack-report.mjs';

describe('packedFiles', () => {
  it('npm 11 数组输出：汇总每个包的文件路径', () => {
    const report = [
      { files: [{ path: 'dist/index.mjs' }, { path: 'README.md' }] },
      { files: [{ path: 'locale/zh.json' }] },
    ];

    expect(packedFiles(report)).toEqual(['dist/index.mjs', 'README.md', 'locale/zh.json']);
  });

  it('npm 12 对象输出：按下标取每个包的报告', () => {
    const report = {
      'dsh-plugin-lark-bridge': {
        id: 'dsh-plugin-lark-bridge@0.1.0',
        files: [{ path: 'dist/index.mjs' }, { path: 'cordis.patch.yml' }],
      },
    };

    expect(packedFiles(report)).toEqual(['dist/index.mjs', 'cordis.patch.yml']);
  });

  it('空对象与空数组：返回空列表', () => {
    expect(packedFiles({})).toEqual([]);
    expect(packedFiles([])).toEqual([]);
  });

  it('报告缺少 files 字段：跳过该包', () => {
    expect(packedFiles([{ id: 'a' }, { files: [{ path: 'README.md' }] }])).toEqual(['README.md']);
  });
});
