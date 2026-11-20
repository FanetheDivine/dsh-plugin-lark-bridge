/** 工作区路径：统一 Linux 风格表示、平台比较与 Host 原生路径转换。 */

/** 判断原始或归一化路径是否使用 Windows 语义。 */
function isWindowsPath(value: string): boolean {
  return /^(?:[A-Za-z]:[\\/]|\\\\|\/\/|\/[A-Za-z](?:\/|$))/.test(value);
}

/** 统一斜杠、末尾分隔符与 Windows 盘符，例如 `C:\work\demo` 转为 `/c/work/demo`。 */
export function normalizeWorkspacePath(value: string): string {
  const slashed = value.trim().replaceAll('\\', '/');
  if (slashed === '') return '';
  const drive = /^([A-Za-z]):(?:\/+(.*))?$/.exec(slashed);
  if (drive !== null) {
    const rest = (drive[2] ?? '').replace(/\/{2,}/g, '/').replace(/\/+$/, '');
    return `/${drive[1]?.toLowerCase()}${rest === '' ? '' : `/${rest}`}`;
  }
  const unc = slashed.startsWith('//');
  const collapsed = slashed.replace(/\/{2,}/g, '/');
  const withoutTrailing = collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : collapsed;
  return unc ? `/${withoutTrailing}` : withoutTrailing;
}

/** 比较工作区路径；Windows 忽略大小写，POSIX 保持大小写敏感。 */
export function sameWorkspacePath(a: string, b: string): boolean {
  const left = normalizeWorkspacePath(a);
  const right = normalizeWorkspacePath(b);
  return isWindowsPath(a) || isWindowsPath(b)
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

/** 在 Host 边界把归一化路径转换为当前平台的原生形式。 */
export function toHostWorkspacePath(
  value: string,
  platform: NodeJS.Platform = process.platform,
): string {
  const normalized = normalizeWorkspacePath(value);
  if (platform !== 'win32') return normalized;
  const drive = /^\/([A-Za-z])(?:\/(.*))?$/.exec(normalized);
  if (drive !== null) {
    return `${drive[1]?.toUpperCase()}:${drive[2] === undefined ? '/' : `/${drive[2]}`}`;
  }
  if (normalized.startsWith('//')) return `\\\\${normalized.slice(2).replaceAll('/', '\\')}`;
  return normalized;
}
