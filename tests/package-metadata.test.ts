// 发布元数据回归测试：npm 在 OIDC 发布时校验 repository.url 与来源仓库一致，
// 缺失或不匹配会以 E422 失败，因此这里把 package.json 与 git origin 对齐。
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** 仓库根目录（tests/ 的上一级）。 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** package.json 中与发布相关的字段。 */
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
  repository?: { type?: string; url?: string };
  homepage?: string;
  bugs?: { url?: string };
};

/** 把 git remote 或 repository.url 归一化为 `https://github.com/<owner>/<repo>`。 */
function normalizeRepoUrl(url: string): string {
  return url
    .replace(/^git\+/, '')
    .replace(/^git@([^:]+):/, 'https://$1/')
    .replace(/^ssh:\/\/git@/, 'https://')
    .replace(/\.git$/, '')
    .replace(/\/$/, '');
}

describe('npm 发布元数据', () => {
  it('repository.url 归一化后等于 git origin', () => {
    const origin = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();

    expect(normalizeRepoUrl(pkg.repository?.url ?? '')).toBe(normalizeRepoUrl(origin));
  });

  it('homepage 与 bugs 由 repository 地址派生', () => {
    const repo = normalizeRepoUrl(pkg.repository?.url ?? '');

    expect(pkg.homepage).toBe(`${repo}#readme`);
    expect(pkg.bugs?.url).toBe(`${repo}/issues`);
  });

  it('repository 声明类型为 git', () => {
    expect(pkg.repository?.type).toBe('git');
  });
});
