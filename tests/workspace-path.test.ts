// 工作区路径测试：Linux 风格归一化、平台比较与 Host 原生路径转换。
import { describe, expect, it } from 'vitest';

import {
  normalizeWorkspacePath,
  sameWorkspacePath,
  toHostWorkspacePath,
} from '../src/workspace-path.ts';

describe('normalizeWorkspacePath', () => {
  it('统一 Windows 盘符、斜杠与末尾分隔符', () => {
    expect(normalizeWorkspacePath('D:\\Git\\self\\')).toBe('/d/Git/self');
    expect(normalizeWorkspacePath('d:/Git//self/')).toBe('/d/Git/self');
    expect(normalizeWorkspacePath('D:\\')).toBe('/d');
  });

  it('保留 POSIX 路径原义', () => {
    expect(normalizeWorkspacePath('/home/user/project/')).toBe('/home/user/project');
    expect(normalizeWorkspacePath('/d/Git')).toBe('/d/Git');
  });

  it('统一 UNC 路径并保留双斜杠前缀', () => {
    expect(normalizeWorkspacePath('\\\\server\\share\\project\\')).toBe('//server/share/project');
  });
});

describe('sameWorkspacePath', () => {
  it('Windows 比较忽略格式与大小写', () => {
    expect(sameWorkspacePath('D:\\Git\\Project', '/d/git/project/')).toBe(true);
  });

  it('POSIX 比较保持大小写敏感', () => {
    expect(sameWorkspacePath('/home/User', '/home/user')).toBe(false);
  });
});

describe('toHostWorkspacePath', () => {
  it('Windows 恢复盘符路径', () => {
    expect(toHostWorkspacePath('/d/Git/self', 'win32')).toBe('D:/Git/self');
    expect(toHostWorkspacePath('D:\\Git\\self', 'win32')).toBe('D:/Git/self');
    expect(toHostWorkspacePath('/d', 'win32')).toBe('D:/');
  });

  it('Windows 恢复 UNC 路径', () => {
    expect(toHostWorkspacePath('//server/share/project', 'win32')).toBe(
      '\\\\server\\share\\project',
    );
  });

  it('POSIX 不做盘符转换', () => {
    expect(toHostWorkspacePath('/d/Git', 'linux')).toBe('/d/Git');
  });
});
