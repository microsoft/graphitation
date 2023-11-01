import { SourceMapGenerator } from "source-map-js";
import { Source, parse } from "graphql";

export function transform(
  source: string,
  sourcePath: string,
  sourceMap: SourceMapGenerator | undefined,
): string | undefined {
  let anyChanges = false;

  if (sourceMap) {
    sourceMap.addMapping({
      original: { line: 1, column: 0 },
      generated: { line: 1, column: 0 },
      source: sourcePath,
    });
  }

  // This represents a chunk of the source either before a graphql tag, inside
  // a graphql tag, or after a graphql tag.
  let lastChunkOffset = 0;
  // This represents the number of lines that have been removed from the
  // generated source due to the removal of graphql tags.
  let lineDelta = 0;

  const result = source.replace(
    /graphql\s*`((?:[^`])*)`/g,
    (taggedTemplateExpression: string, sdl: string, offset: number) => {
      let documentName: string | undefined;
      try {
        // In the absence of parsing the full JS/TS file, we may run into false
        // positives. We detect this by attempting to parse the tagged template
        // expression. If it fails, we assume it is not a [valid] graphql tag.
        const location = offsetToLineColumn(source, offset); // TODO: This needs a test
        const ast = parse(
          new Source(sdl, sourcePath, {
            line: location.line,
            column: location.column + 1,
          }),
        );
        // Additionally, we perform some basic validation to ensure that the doc
        // matches the expected format.
        if (ast.definitions.length !== 1) {
          throw new Error(
            "Expected exactly one definition in GraphQL document",
          );
        }
        const document = ast.definitions[0];
        if (
          document.kind !== "OperationDefinition" &&
          document.kind !== "FragmentDefinition"
        ) {
          throw new Error(
            "Expected GraphQL document to contain an operation or fragment definition",
          );
        }
        documentName = document.name?.value;
        if (!documentName) {
          throw new Error("Expected GraphQL definition to have a name");
        }
      } catch {
        // TODO: callback to report error with location of document, except for the
        //       case where we extracted a non-expression with our regex.
        return taggedTemplateExpression;
      }

      anyChanges = true;

      if (sourceMap) {
        addNewLineMappings(
          lastChunkOffset,
          offset,
          source,
          sourceMap,
          lineDelta,
          sourcePath,
        );
      }

      lastChunkOffset = offset + taggedTemplateExpression.length;

      const generated = `require("./__generated__/${documentName}.graphql").default`;

      if (sourceMap) {
        const originalStart = offsetToLineColumn(source, offset);
        sourceMap.addMapping({
          original: originalStart,
          generated: {
            line: originalStart.line - lineDelta,
            column: originalStart.column,
          },
          source: sourcePath,
        });

        const originalEndOffset = offset + taggedTemplateExpression.length;
        forEachNewLine(offset, originalEndOffset, source, (offset) => {
          const lineStart = offsetToLineColumn(source, offset);
          sourceMap.addMapping({
            original: lineStart,
            generated: {
              line: originalStart.line - lineDelta,
              column: originalStart.column,
            },
            source: sourcePath,
          });
        });

        sourceMap.addMapping({
          original: offsetToLineColumn(source, originalEndOffset),
          generated: {
            line: originalStart.line - lineDelta,
            column: originalStart.column + generated.length,
          },
          source: sourcePath,
        });

        lineDelta += taggedTemplateExpression.split("\n").length - 1;
      }

      return generated;
    },
  );

  // Quick bail out if we didn't make any changes. This avoids any unnecessary work towards SourceMaps generation.
  if (!anyChanges) {
    return undefined;
  }

  if (sourceMap) {
    addNewLineMappings(
      lastChunkOffset,
      source.length,
      source,
      sourceMap,
      lineDelta,
      sourcePath,
    );
  }

  return result;
}

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

function forEachNewLine(
  start: number,
  end: number,
  source: string,
  callback: (offset: number) => void,
) {
  for (let i = start; i < end; i++) {
    if (source[i] === "\n") {
      callback(i + 1);
    }
  }
}

function addNewLineMappings(
  start: number,
  end: number,
  source: string,
  sourceMap: SourceMapGenerator,
  lineDelta: number,
  sourcePath: string,
) {
  forEachNewLine(start, end, source, (offset) => {
    const lineStart = offsetToLineColumn(source, offset);
    sourceMap.addMapping({
      original: lineStart,
      generated: {
        line: lineStart.line - lineDelta,
        column: lineStart.column,
      },
      source: sourcePath,
    });
  });
}
