/** 调度工作区内的路径形态：相对工作区根、以 `/` 分隔。导出 workspaceRelative。 */
import { relative } from 'node:path';

/**
 * 把绝对路径转成相对调度工作区根、以 `/` 分隔的路径。
 * @param root - 调度工作区根。
 * @param absolutePath - 位于工作区内的绝对路径。
 * @returns 相对路径；路径不在根内时返回原路径（统一为 `/`）。
 */
export function workspaceRelative(root: string, absolutePath: string): string {
  const rel = relative(root, absolutePath);
  const outside = rel === '' || rel.startsWith('..') || /^[a-zA-Z]:/.test(rel);
  return (outside ? absolutePath : rel).replaceAll('\\', '/');
}
