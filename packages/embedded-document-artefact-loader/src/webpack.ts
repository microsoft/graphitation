import type { LoaderDefinitionFunction } from "webpack";
import { SourceMapGenerator, RawSourceMap } from "source-map-js";
import { transform } from "./transform";
import { applySourceMap } from "./source-map-utils";

type Options = {
  artifactDirectory?: string;
};

const webpackLoader: LoaderDefinitionFunction<Options> = function (
  source,
  inputSourceMap,
  _additionalData,
) {
  const callback = this.async();

  // Using query instead of getOptions to support webpack 4
  // and the loader-runner doesn't support getOptions (yet)
  const options =
    typeof this.query !== "string" && this.query.artifactDirectory
      ? { artifactDirectory: this.query.artifactDirectory }
      : undefined;

  let sourceMap: SourceMapGenerator | undefined;
  if (this.sourceMap) {
    sourceMap = new SourceMapGenerator({
      file: this.resourcePath + ".map",
    });
    sourceMap.setSourceContent(this.resourcePath, source);
  }

  const transformed = transform(source, this.resourcePath, sourceMap, options);

  if (transformed && sourceMap && inputSourceMap) {
    const sourceMapJSON = sourceMap.toJSON() as RawSourceMap & { file: string };
    callback(
      null,
      transformed,
      applySourceMap(
        this.resourcePath,
        inputSourceMap as string,
        sourceMapJSON,
      ).toJSON() as RawSourceMap & { file: string },
    );
  } else if (transformed && sourceMap) {
    callback(null, transformed, sourceMap.toJSON() as RawSourceMap & { file: string });
  } else if (transformed) {
    callback(null, transformed, inputSourceMap);
  } else {
    callback(null, source, inputSourceMap);
  }
};

export default webpackLoader;
