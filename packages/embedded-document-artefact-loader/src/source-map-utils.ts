import { SourceMapConsumer, SourceMapGenerator } from "source-map-js";

export function applySourceMap(
  sourcePath: string,
  sourceMap1: string,
  sourceMap2: string,
): string {
  const smc1 = new SourceMapConsumer(JSON.parse(sourceMap1));
  const smc2 = new SourceMapConsumer(JSON.parse(sourceMap2!));
  const pipeline = SourceMapGenerator.fromSourceMap(smc2);
  pipeline.applySourceMap(smc1, sourcePath);
  return pipeline.toString();
}
