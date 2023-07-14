import type { LoaderDefinitionFunction } from "webpack";
import { SourceMapConsumer, SourceMapGenerator } from "source-map";
import { transform } from "./transform";

const webpackLoader: LoaderDefinitionFunction = function (
  source,
  inputSourceMap,
  _additionalData,
) {
  const callback = this.async();

  let sourceMap: SourceMapGenerator | undefined;
  if (this.sourceMap) {
    // sourceMap = inputSourceMap
    //   ? SourceMapGenerator.fromSourceMap(
    //       new SourceMapConsumer(JSON.parse(inputSourceMap as string)),
    //     )
    //   : new SourceMapGenerator({
    //       file: this.resourcePath + ".map",
    //     });
    sourceMap = new SourceMapGenerator({
      file: this.resourcePath + ".map",
    });
    sourceMap.setSourceContent(this.resourcePath, source);
  }

  const result = transform(source, this.resourcePath, sourceMap);

  if (sourceMap && inputSourceMap) {
    const compoundSourceMap = SourceMapGenerator.fromSourceMap(
      new SourceMapConsumer(JSON.parse(inputSourceMap as string)),
    );
    compoundSourceMap.applySourceMap(
      new SourceMapConsumer(JSON.parse(sourceMap.toString())),
    );

    sourceMap = compoundSourceMap;
  }

  callback(null, result, sourceMap?.toString());
};

export default webpackLoader;
