// registry 版本查询：判断当前版本是否已发布，供 CI 跳过重复发布。
// 导出 isVersionPublished 供 vitest 使用；作为 CLI 时输出 exists=true|false 到 stdout。
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** registry 根地址，只在测试中通过参数替换 fetch 实现。 */
const REGISTRY = 'https://registry.npmjs.org';

/** 精简元数据响应，体积小于完整文档。 */
const ACCEPT = 'application/vnd.npm.install-v1+json';

/** 查询 registry 是否已有 `name@version`；包不存在返回 false，其它异常抛出。 */
export async function isVersionPublished(name, version, fetchImpl = fetch) {
  const url = `${REGISTRY}/${encodeURIComponent(name)}`;
  const res = await fetchImpl(url, { headers: { accept: ACCEPT } });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`registry 查询失败：${url} 返回 HTTP ${res.status}`);
  const doc = await res.json();
  return Object.hasOwn(doc.versions ?? {}, version);
}

/** 读取根目录 package.json 的 name 与 version，打印判定结果。 */
async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const exists = await isVersionPublished(pkg.name, pkg.version);
  process.stdout.write(`exists=${exists}\n`);
}

// 仅在作为 CLI 直接执行时运行（import 用于测试时无副作用）
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
