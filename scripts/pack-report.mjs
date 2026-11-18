// npm pack --json 报告解析：npm 11 返回数组，npm 12 返回以包名为键的对象。
// 导出 packedFiles 供 vitest 与打包测试共用。

/** 从 npm pack --json 报告提取 tarball 内的文件路径；无法识别的字段按空列表处理。 */
export function packedFiles(report) {
  const items = Array.isArray(report) ? report : Object.values(report ?? {});
  return items.flatMap((item) => (item?.files ?? []).map((file) => file.path));
}
