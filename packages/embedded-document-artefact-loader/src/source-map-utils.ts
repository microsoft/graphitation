import {
  SourceMapConsumer,
  SourceMapGenerator,
  RawSourceMap,
} from "source-map-js";

export function applySourceMap(
  sourcePath: string,
  previousSourceMap: string | RawSourceMap,
  nextSourceMap: string,
): string {
  const prev = new SourceMapConsumer(
    typeof previousSourceMap === "string"
      ? JSON.parse(previousSourceMap)
      : previousSourceMap,
  );
  const next = new SourceMapConsumer(JSON.parse(nextSourceMap));
  const pipeline = SourceMapGenerator.fromSourceMap(next);
  pipeline.applySourceMap(prev, sourcePath);
  return pipeline.toString();
}
