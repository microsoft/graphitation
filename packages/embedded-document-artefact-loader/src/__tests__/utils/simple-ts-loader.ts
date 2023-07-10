import type { LoaderDefinitionFunction } from "webpack";
import * as ts from "typescript";

const simpleTSLoader: LoaderDefinitionFunction = function (
  source,
  _sourceMap,
  _additionalData,
) {
  const callback = this.async();

  const { outputText, sourceMapText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2015,
      target: ts.ScriptTarget.ES2015,
      sourceMap: true,
      inlineSources: true,
      inlineSourceMap: false,
    },
    fileName: "fixture.ts",
  });

  callback(null, outputText, sourceMapText);
};

export default simpleTSLoader;
