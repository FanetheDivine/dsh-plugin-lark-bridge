// package.json 打包回归测试：npm pack --dry-run 断言 tarball 只含发布所需文件。
// files 字段（package.json）决定分发内容：dist + cordis.patch.yml + locale/*.json + README.md；
// src / tests / scripts 等开发文件不得进包。产物由 build 生成，过期时测试失败。
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { packedFiles } from '../scripts/pack-report.mjs';
import { assertFreshDist } from './support/dist-freshness.ts';

/** 仓库根目录（tests/ 的上一级）。 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 发布清单中的运行时依赖。 */
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
  dependencies?: Record<string, string>;
};

/** 打包结果的缓存：同一进程内只执行一次 npm pack。 */
let cachedPaths: Set<string> | undefined;

/** 执行 npm pack --dry-run --json，返回 tarball 内文件路径集合。 */
function packedPaths(): Set<string> {
  if (cachedPaths !== undefined) return cachedPaths;
  assertFreshDist();
  const res = spawnSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    // Windows 下 npm 是 npm.cmd，需经 shell 启动
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) {
    throw new Error(`npm pack --dry-run 失败：${String(res.stderr ?? res.stdout ?? '未知错误')}`);
  }
  // npm 11 返回数组，npm 12 返回以包名为键的对象；packedFiles 归一化两种输出
  cachedPaths = new Set(packedFiles(JSON.parse(String(res.stdout ?? '[]'))));
  return cachedPaths;
}

describe('npm 包内容（npm pack --dry-run）', () => {
  it('清单与 tarball 均不携带 lark-cli', () => {
    expect(manifest.dependencies?.['@larksuite/cli']).toBeUndefined();
    const forbidden = [...packedPaths()].filter(
      (file) =>
        file.startsWith('node_modules/@larksuite/cli/') ||
        /(^|\/)lark-cli(?:\.exe)?$/i.test(file) ||
        /(^|\/)(?:\.lark-cli|lark-cli-cache)(?:\/|$)/i.test(file) ||
        /lark-cli.*\.(?:zip|tgz|tar|gz)$/i.test(file),
    );
    expect(forbidden).toEqual([]);
  }, 30_000);

  it('tarball 含 dist/cordis.patch.yml/locale/README.md，不含 src/tests/scripts', () => {
    const packed = packedPaths();
    expect(packed.has('dist/index.mjs')).toBe(true);
    expect(packed.has('dist/index.d.ts')).toBe(true);
    expect(packed.has('dist/client.js')).toBe(true);
    expect(packed.has('cordis.patch.yml')).toBe(true);
    expect(packed.has('README.md')).toBe(true);
    expect(packed.has('locale/en.json')).toBe(true);
    expect(packed.has('locale/zh.json')).toBe(true);
    expect([...packed].some((p) => p.startsWith('src/'))).toBe(false);
    expect([...packed].some((p) => p.startsWith('tests/'))).toBe(false);
    expect([...packed].some((p) => p.startsWith('scripts/'))).toBe(false);
  }, 30_000);

  it('前端产物以包名注册闭包工厂', () => {
    // 读取的产物与包内容一致
    packedPaths();
    const client = readFileSync(path.join(ROOT, 'dist', 'client.js'), 'utf8');
    expect(client).toContain('window.__ModuleLoader__.load(');
    expect(client).toContain('id: "dsh-plugin-lark-bridge"');
    expect(client).not.toContain('exports.inject');
    expect(client).toContain('exports.apply');
  });
});
