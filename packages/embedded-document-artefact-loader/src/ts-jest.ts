import { transform } from "./transform";
import tsLoader from "ts-jest";
import { SourceMapGenerator } from "source-map-js";

import type { TransformerFactory, SyncTransformer } from "@jest/transform";
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
        const sourceMap = generateSourceMap
          ? new SourceMapGenerator()
          : undefined;
        sourceMap?.setSourceContent(sourcePath, sourceText);
        const transformed = transform(sourceText, sourcePath, sourceMap);

        let tsResult = tsLoaderInstance.process(
          transformed || sourceText,
          sourcePath,
          options,
        );

        if (sourceMap && transformed) {
          const [tsResultCode, tsResultMap] = extractInlineSourceMap(
            tsResult.code,
          );
          if (tsResultMap === undefined) {
            throw new Error("Expected inline source-map");
          }
          // TODO: Determine why ts-jest insists on using inline source-maps
          //       and/or if it's cheaper to inline the source-map again
          //       ourselves rather than letting jest do the work.
          tsResult = {
            code: tsResultCode,
            map: applySourceMap(
              sourcePath,
              sourceMap.toString(),
              tsResultMap,
            ) as any, // SourceMapGenerator seems to satisfy the runtime needs, but it's unclear which properties it uses exactly
          };
        }

        return tsResult;
      },
      processAsync(sourceText, sourcePath, options) {
        const sourceMapGenerator = new SourceMapGenerator();
        sourceMapGenerator.setSourceContent(sourcePath, sourceText);

        return tsLoaderInstance.processAsync(
          transform(sourceText, sourcePath, sourceMapGenerator)!,
          sourcePath,
          options,
        );
      },
    };
  },
};

export default transformerFactory;
