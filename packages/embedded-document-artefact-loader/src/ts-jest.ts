import { transform } from "./transform";
import tsLoader from "ts-jest";
import { SourceMapGenerator } from "source-map-js";

import type {
  TransformerFactory,
  SyncTransformer,
  TransformedSource,
} from "@jest/transform";
import type { TsJestGlobalOptions } from "ts-jest";
import { extractInlineSourceMap } from "./addInlineSourceMap";
import { applySourceMap } from "./source-map-utils";

const transformerFactory: TransformerFactory<SyncTransformer<unknown>> = {
  createTransformer(config) {
    const tsLoaderInstance = tsLoader.createTransformer(
      config as TsJestGlobalOptions,
    );
    const generateSourceMap = true;
    return {
      ...tsLoaderInstance,
      process(sourceText, sourcePath, options) {
        const { transformed, sourceMap } = applyTransform(
          generateSourceMap,
          sourcePath,
          sourceText,
        );

        const tsResult = tsLoaderInstance.process(
          transformed || sourceText,
          sourcePath,
          options,
        );

        return extractAndApplySourceMap(
          sourceMap,
          transformed,
          tsResult,
          sourcePath,
        );
      },
      async processAsync(sourceText, sourcePath, options) {
        const { transformed, sourceMap } = applyTransform(
          generateSourceMap,
          sourcePath,
          sourceText,
        );

        const tsResult = await tsLoaderInstance.processAsync(
          transformed || sourceText,
          sourcePath,
          options,
        );

        return extractAndApplySourceMap(
          sourceMap,
          transformed,
          tsResult,
          sourcePath,
        );
      },
    };
  },
};

function extractAndApplySourceMap(
  sourceMap: SourceMapGenerator | undefined,
  transformed: string | undefined,
  tsResult: TransformedSource,
  sourcePath: string,
) {
  if (sourceMap && transformed) {
    // TODO: Determine why ts-jest insists on using inline source-maps
    //       and/or if it's cheaper to inline the source-map again
    //       ourselves rather than letting jest do the work.
    const [tsResultCode, tsResultMap] = extractInlineSourceMap(tsResult.code);
    if (tsResultMap === undefined) {
      throw new Error("Expected inline source-map");
    }
    tsResult = {
      code: tsResultCode,
      map: applySourceMap(sourcePath, sourceMap.toJSON(), tsResultMap).toJSON(),
    };
  }
  return tsResult;
}

function applyTransform(
  generateSourceMap: boolean,
  sourcePath: string,
  sourceText: string,
) {
  const sourceMap = generateSourceMap ? new SourceMapGenerator() : undefined;
  sourceMap?.setSourceContent(sourcePath, sourceText);
  const transformed = transform(sourceText, sourcePath, sourceMap);
  return { transformed, sourceMap };
}

export default transformerFactory;
