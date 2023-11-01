import {
  SourceMapConsumer,
  SourceMapGenerator,
  RawSourceMap,
} from "source-map-js";

function toRawSourceMap(sourceMap: string | RawSourceMap): RawSourceMap {
  return typeof sourceMap === "string" ? JSON.parse(sourceMap) : sourceMap;
}

export function applySourceMap(
  sourcePath: string,
  previousSourceMap: string | RawSourceMap,
  nextSourceMap: string | RawSourceMap,
): SourceMapGenerator {
  const prev = new SourceMapConsumer(toRawSourceMap(previousSourceMap));
  const next = new SourceMapConsumer(toRawSourceMap(nextSourceMap));
  const pipeline = SourceMapGenerator.fromSourceMap(next);
  pipeline.applySourceMap(prev, sourcePath);
  return pipeline;
}
