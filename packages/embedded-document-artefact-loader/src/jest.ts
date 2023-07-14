import type { TransformerFactory, SyncTransformer } from "@jest/transform";
import { transform } from "./transform";
import tsLoader, { TsJestGlobalOptions } from "ts-jest";

const transformerFactory: TransformerFactory<SyncTransformer<unknown>> = {
  createTransformer(config) {
    const tsLoaderInstance = tsLoader.createTransformer(
      config as TsJestGlobalOptions,
    );
    return {
      ...tsLoaderInstance,
      process(sourceText, sourcePath, options) {
        return tsLoaderInstance.process(
          transform(sourceText, sourcePath, undefined),
          sourcePath,
          options,
        );
      },
      processAsync(sourceText, sourcePath, options) {
        return tsLoaderInstance.processAsync(
          transform(sourceText, sourcePath, undefined),
          sourcePath,
          options,
        );
      },
    };
  },
};

export default transformerFactory;
