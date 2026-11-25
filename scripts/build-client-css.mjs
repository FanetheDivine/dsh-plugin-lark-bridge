/**
 * 生成 Tailwind utilities：把 src/client/tailwind.css 编译成 tailwind.generated.css。
 * tsdown 之后会把该文件与手写 CSS 一起收进 dist/client.css。
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** 仓库根目录。 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Tailwind CLI 的 JS 入口，避免依赖平台相关的 .bin 包装脚本。 */
const CLI = path.join(ROOT, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs');

const result = spawnSync(
  process.execPath,
  [
    CLI,
    '--input',
    path.join(ROOT, 'src', 'client', 'tailwind.css'),
    '--output',
    path.join(ROOT, 'src', 'client', 'tailwind.generated.css'),
    '--minify',
  ],
  { cwd: ROOT, stdio: 'inherit' },
);

if (result.status !== 0) {
  console.error('Tailwind CSS 生成失败');
  process.exit(result.status ?? 1);
}
