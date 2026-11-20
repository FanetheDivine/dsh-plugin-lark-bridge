/** 零依赖工具函数。 */

/** 判断值是否为普通对象。 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 判断字符串是否含有非空白字符。 */
export function hasText(value: string): boolean {
  return value.trim() !== '';
}

/** 把毫秒时间戳或 ISO 文本转成 `YYYY-MM-DD HH:mm:ss`；非法值返回空串。 */
export function formatTime(value: string | number | undefined, timeZone = 'Asia/Shanghai'): string {
  const date = typeof value === 'number' ? new Date(value) : new Date(String(value ?? ''));
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

/** 转义属性值中的 `&`、`"` 与 `<`。 */
export function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

/** 解析毫秒时间戳字符串；非法值返回当前时间。 */
export function parseTimestamp(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
}

/**
 * 把文本包成 system-reminder 帧。
 * @param text - 提醒正文。
 * @returns 完整的 `<system-reminder>` 文本。
 */
export function reminder(text: string): string {
  const body = text.replaceAll('</system-reminder>', '<\\/system-reminder>').trim();
  return `<system-reminder>\n${body}\n</system-reminder>`;
}

/**
 * 按上限切分文本，优先在换行处断开，不拆代理对。
 * @param text - 原始文本。
 * @param limit - 每段最大 UTF-16 单元数。
 * @returns 顺序保持的分段。
 */
export function splitText(text: string, limit: number): string[] {
  const parts: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n', limit);
    if (cut < limit / 2) cut = limit;
    const code = rest.charCodeAt(cut - 1);
    if (code >= 0xd800 && code <= 0xdbff) cut -= 1;
    parts.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, '');
  }
  parts.push(rest);
  return parts;
}

/** 规范化路径用于比较；Windows 忽略大小写与斜杠差异。 */
export function samePath(a: string, b: string): boolean {
  const normalize = (value: string): string => {
    const slashed = value.replaceAll('\\', '/').replace(/\/+$/, '');
    return process.platform === 'win32' ? slashed.toLowerCase() : slashed;
  };
  return normalize(a) === normalize(b);
}

/** 压缩并截断一段用于日志的错误文本。 */
export function describeError(error: unknown, max = 500): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
