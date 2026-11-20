// 插件图标测试：校验包内 SVG 可被宿主解码，且清单声明与打包位置一致。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/** 仓库根目录（tests/ 的上一级）。 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** 图标文件路径。 */
const ICON = path.join(ROOT, 'icon.svg');

/** 宿主允许的图标上限。 */
const MAX_BYTES = 256 * 1024;

/** 图标原文。 */
const svg = readFileSync(ICON, 'utf8');

/** package.json 中与图标相关的字段。 */
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
  icon?: string;
  exports?: Record<string, unknown>;
  files?: string[];
};

describe('插件图标', () => {
  it('是 36×36 的自包含 SVG', () => {
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('viewBox="0 0 36 36"');
    expect(svg).toContain('<path');
    expect(svg).toContain('<title>');
  });

  it('使用透明背景与飞书三段标志色', () => {
    expect(svg).not.toContain('fill="white"');
    for (const color of ['#00D6B9', '#3370FF', '#133C9A']) {
      expect(svg).toContain(color);
    }
  });

  it('不含脚本、外链图片与内联样式', () => {
    for (const forbidden of ['<script', '<image', '<foreignObject', '<style']) {
      expect(svg).not.toContain(forbidden);
    }
    expect(svg).not.toMatch(/\son[a-z]+=/i);
  });

  it('不超过宿主上限', () => {
    expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(MAX_BYTES);
  });

  it('清单声明顶层 icon、子路径导出与打包项', () => {
    expect(manifest.icon).toBe('./icon.svg');
    expect(manifest.exports?.['./icon']).toBe('./icon.svg');
    expect(manifest.files).toContain('icon.svg');
  });
});