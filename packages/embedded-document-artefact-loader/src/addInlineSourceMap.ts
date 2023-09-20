const COMMENT =
  "//# sourceMappingURL=data:application/json;charset=utf-8;base64,";

export function addInlineSourceMap(source: string, sourceMap: string) {
  return `${source}\n${COMMENT}${Buffer.from(sourceMap).toString("base64")}\n`;
}

export function extractInlineSourceMap(
  source: string,
): [code: string, map: string | undefined] {
  const [sourceWithoutSourceMap, encodedSourceMap] = source.split(COMMENT);
  if (encodedSourceMap && sourceWithoutSourceMap) {
    return [
      sourceWithoutSourceMap,
      Buffer.from(encodedSourceMap, "base64").toString("utf8"),
    ];
  } else {
    return [sourceWithoutSourceMap, undefined];
  }
}
