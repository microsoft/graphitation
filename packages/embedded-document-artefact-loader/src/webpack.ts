import type { LoaderDefinitionFunction } from "webpack";
import { SourceMapConsumer, SourceMapGenerator } from "source-map-js";
import { transform } from "./transform";
import { applySourceMap } from "./source-map-utils";

const webpackLoader: LoaderDefinitionFunction = function (
  source,
  inputSourceMap,
  _additionalData,
) {
  const callback = this.async();

  let sourceMap: SourceMapGenerator | undefined;
  if (this.sourceMap) {
    sourceMap = new SourceMapGenerator({
      file: this.resourcePath + ".map",
    });
    sourceMap.setSourceContent(this.resourcePath, source);
  }

  const transformed = transform(source, this.resourcePath, sourceMap);

  if (transformed && sourceMap && inputSourceMap) {
    callback(
      null,
      transformed,
      applySourceMap(
        this.resourcePath,
        inputSourceMap as string,
        sourceMap.toString(),
      ),
    );
  } else if (transformed && sourceMap) {
    callback(null, transformed, sourceMap.toString());
  } else if (transformed) {
    callback(null, transformed);
  } else {
    callback(null, source);
  }
};

export default webpackLoader;
