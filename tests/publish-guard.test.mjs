// publish-guard 单测：registry 版本判定覆盖已发布、包不存在、版本缺失与查询失败。
import { describe, expect, it, vi } from 'vitest';
import { isVersionPublished } from '../scripts/publish-guard.mjs';

/** 构造判定逻辑所需的最小响应对象。 */
function response(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('isVersionPublished', () => {
  it('registry 有目标版本：返回 true，并请求精简元数据', async () => {
    const fetchImpl = vi.fn(async () => response(200, { versions: { '0.1.0': {}, '0.2.0': {} } }));

    await expect(isVersionPublished('dsh-plugin-lark-bridge', '0.1.0', fetchImpl)).resolves.toBe(
      true,
    );
    expect(fetchImpl).toHaveBeenCalledWith('https://registry.npmjs.org/dsh-plugin-lark-bridge', {
      headers: { accept: 'application/vnd.npm.install-v1+json' },
    });
  });

  it('包不存在：registry 返回 404 时返回 false', async () => {
    const fetchImpl = vi.fn(async () => response(404, {}));

    await expect(isVersionPublished('dsh-plugin-lark-bridge', '0.1.0', fetchImpl)).resolves.toBe(
      false,
    );
  });

  it('包存在但版本缺失：返回 false', async () => {
    const fetchImpl = vi.fn(async () => response(200, { versions: { '0.2.0': {} } }));

    await expect(isVersionPublished('dsh-plugin-lark-bridge', '0.1.0', fetchImpl)).resolves.toBe(
      false,
    );
  });

  it('范围包名按 URL 段编码', async () => {
    const fetchImpl = vi.fn(async () => response(200, { versions: {} }));

    await isVersionPublished('@scope/pkg', '1.0.0', fetchImpl);

    expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://registry.npmjs.org/%40scope%2Fpkg');
  });

  it('其它错误状态：抛出带 URL 与状态码的错误，避免误判后重复发布', async () => {
    const fetchImpl = async () => response(500, {});

    await expect(isVersionPublished('pkg', '1.0.0', fetchImpl)).rejects.toThrow(
      'registry 查询失败：https://registry.npmjs.org/pkg 返回 HTTP 500',
    );
  });

  it('网络异常：原样抛出', async () => {
    const fetchImpl = async () => {
      throw new Error('ECONNRESET');
    };

    await expect(isVersionPublished('pkg', '1.0.0', fetchImpl)).rejects.toThrow('ECONNRESET');
  });
});
