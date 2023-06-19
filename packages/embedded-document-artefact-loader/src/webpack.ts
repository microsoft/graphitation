import type { LoaderDefinitionFunction } from "webpack";
import { SourceMapGenerator } from "source-map";

function offsetToLineColumn(
  str: string,
  offset: number,
): { line: number; column: number } {
  let line = 1;
  let column = 0;
  for (let i = 0; i < offset; i++) {
    if (str[i] === "\n") {
      line++;
      column = 0;
    } else {
      column++;
    }
  }
  return { line, column };
}

const webpackLoader: LoaderDefinitionFunction = function (
  source,
  _sourceMap,
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

  const result = source.replace(
    /graphql\s*`(?:[^`])*`/g,
    (taggedTemplateExpression, offset: number) => {
      const match = taggedTemplateExpression.match(
        /(query|mutation|subscription|fragment)\s+\b(.+?)\b/,
      );
      if (match && match[2]) {
        const generated = `require("./__generated__/${match[2]}.graphql").default`;

        if (sourceMap) {
          const originalStart = offsetToLineColumn(source, offset);
          sourceMap.addMapping({
            original: originalStart,
            generated: originalStart,
            source: this.resourcePath,
          });
          sourceMap.addMapping({
            original: offsetToLineColumn(
              source,
              offset + taggedTemplateExpression.length,
            ),
            generated: {
              line: originalStart.line,
              column: originalStart.column + generated.length,
            },
            source: this.resourcePath,
          });
        }

        return generated;
      }
      return taggedTemplateExpression;
    },
  );

  callback(null, result, sourceMap?.toString());
};

export default webpackLoader;
