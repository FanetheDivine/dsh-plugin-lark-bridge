/** 原子替换文件：Windows 上读取中的目标会短暂拒绝 rename，重试几次。 */
import { rename } from 'node:fs/promises';

const RETRY_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);

/**
 * 把临时文件改名为目标文件；目标被短暂占用时重试。
 * @param temporary - 已写入的临时文件。
 * @param target - 最终路径。
 * @param attempts - 最多尝试次数。
 */
export async function replaceFile(temporary: string, target: string, attempts = 5): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await rename(temporary, target);
      return;
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null
          ? (error as { code?: unknown }).code
          : undefined;
      if (attempt >= attempts || typeof code !== 'string' || !RETRY_CODES.has(code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * attempt));
    }
  }
}
