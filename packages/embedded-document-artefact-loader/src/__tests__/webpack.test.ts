import { RunLoaderResult, runLoaders } from "loader-runner";
import { SourceMapConsumer } from "source-map";

function runLoader(
  source: string,
  options?: { sourceMap?: boolean; compileTS?: boolean },
) {
  return new Promise<RunLoaderResult>((resolve, reject) => {
    runLoaders(
      {
        resource: "fixture.ts",
        loaders: [
          {
            loader: require.resolve("../webpack.ts"),
            options: {},
          },
          options?.compileTS && {
            loader: require.resolve("./utils/simple-ts-loader.ts"),
            options: {},
          },
        ].filter(Boolean),
        context: {
          sourceMap: options?.sourceMap ?? true,
        },
        readResource: (_path, callback) => {
          callback(null, Buffer.from(source));
        },
      },
      (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      },
    );
  });
}

function getPositionOffset(str: string, line: number, column: number): number {
  const lines = str.split("\n");
  let offset = 0;
  for (let i = 0; i < line - 1; i++) {
    offset += lines[i].length + 1;
  }
  offset += column;
  return offset;
}

describe("webpackLoader", () => {
  it.todo("works with watch query documents");
  it.todo("has a dependency on the artefact file");

  it.each([
    {
      name: "files that contain no embedded documents",
      source: `
        import { graphql } from "@nova/react";
        console.log()
      `,
    },
    {
      name: "documents with query operations",
      source: `
        import { graphql } from "@nova/react";
        const doc = graphql\`
          query SomeComponentQuery($id: ID!) {
            helloWorld
          }
        \`;
        console.log()
      `,
    },
    {
      name: "documents with mutation operations",
      source: `
        import { graphql } from "@nova/react";
        const doc = graphql\`
          mutation SomeComponentMutation($id: ID!) {
            helloWorld
          }
        \`;
        console.log()
      `,
    },
    {
      name: "documents with subscription operations",
      source: `
        import { graphql } from "@nova/react";
        const doc = graphql\`
          subscription SomeComponentSubscription($id: ID!) {
            helloWorld
          }
        \`;
        console.log()
      `,
    },
    {
      name: "documents captured as variable",
      source: `
        import { graphql } from "@nova/react";
        const doc = graphql\`
          fragment SomeComponentFragment on Query {
            helloWorld
          }
        \`
        const {data} = useFragment(doc, props);
      `,
    },
    {
      name: "inline documents",
      source: `
        import { graphql } from "@nova/react";
        const {data} = useFragment(graphql\`
          fragment SomeComponentFragment on Query {
            helloWorld
          }
        \`, props);
      `,
    },
    {
      name: "inline documents over multiple lines",
      source: `
        import { graphql } from "@nova/react";
        const {data} = useFragment(
          graphql\`
            fragment SomeComponentFragment on Query {
              helloWorld
            }
          \`,
          props
        );
      `,
    },
  ])("works with $name", async ({ source }) => {
    const result = await runLoader(source);
    expect(result.result![0]).toMatchSnapshot();
  });

  describe("concerning source-maps", () => {
    it("does not emit source-maps if webpack is configured to not emit them", async () => {
      const source = `
        import { graphql } from "@nova/react";
        const doc = graphql\`query SomeComponentQuery($id: ID!) { helloWorld }\`;
        console.log()
      `;

      const result = await runLoader(source, { sourceMap: false });
      const sourceMap = result.result![1];

      expect(sourceMap).toBeUndefined();
    });

    it("emits source-map for tagged template on a single line", async () => {
      const source = `
        import { graphql } from "@nova/react";
        const doc = graphql\`query SomeComponentQuery($id: ID!) { helloWorld }\`;
        console.log()
      `;

      const result = await runLoader(source);
      const transpiled = result.result![0]?.toString();
      const sourceMap = result.result![1];

      const consumer = new SourceMapConsumer(sourceMap!.toString() as any);
      const [startPosition, endPosition] = consumer.allGeneratedPositionsFor({
        line: 2,
        column: undefined as any,
        source: "fixture.ts",
      });
      const startOffset = getPositionOffset(
        transpiled!,
        startPosition.line,
        startPosition.column,
      );
      const endOffset = getPositionOffset(
        transpiled!,
        endPosition.line,
        endPosition.column,
      );

      expect(transpiled?.slice(startOffset, endOffset)).toMatchInlineSnapshot(
        `"require("./__generated__/SomeComponentQuery.graphql").default"`,
      );
    });

    it("emits source-map for tagged template with multiple lines", async () => {
      const source = `
        import { graphql } from "@nova/react";
        const doc = graphql\`
          query SomeComponentQuery($id: ID!) {
            helloWorld
          }
        \`;
        console.log()
      `;

      const result = await runLoader(source);
      const transpiled = result.result![0]?.toString();
      const sourceMap = result.result![1];

      const consumer = new SourceMapConsumer(sourceMap!.toString() as any);
      const startPosition = consumer.generatedPositionFor({
        line: 3,
        column: 20,
        source: "fixture.ts",
      });
      const endPosition = consumer.generatedPositionFor({
        line: 7,
        column: 10,
        source: "fixture.ts",
      });
      const startOffset = getPositionOffset(
        transpiled!,
        startPosition.line,
        startPosition.column,
      );
      const endOffset = getPositionOffset(
        transpiled!,
        endPosition.line,
        endPosition.column,
      );

      expect(transpiled?.slice(startOffset, endOffset)).toMatchInlineSnapshot(
        `"require("./__generated__/SomeComponentQuery.graphql").default"`,
      );
    });

    xit("emits source-map that expands on existing input map", async () => {
      // The import over multiple lines is important here, as it will transpile to a single line
      // and the source-map should be able to map back to the original source with multiple lines.
      const source = `
        import {
          graphql
        } from "@nova/react";
        const doc = graphql\`query SomeComponentQuery($id: ID!) { helloWorld }\`;
        console.log()
      `;

      const result = await runLoader(source, { compileTS: true });
      const transpiled = result.result![0]?.toString();
      const sourceMap = result.result![1];
      // console.log(transpiled);
      console.log(sourceMap);

      const consumer = new SourceMapConsumer(sourceMap!.toString() as any);
      // consumer.eachMapping((mapping) => {
      //   console.log(mapping);
      // });
      consumer.computeColumnSpans();
      console.log(
        consumer.allGeneratedPositionsFor({
          line: 5,
          column: undefined as any,
          source: "fixture.ts",
        }),
      );
      const [startPosition, endPosition] = consumer.allGeneratedPositionsFor({
        line: 5,
        column: undefined as any,
        source: "fixture.ts",
      });
      const x = consumer.generatedPositionFor({
        line: 5,
        column: 20,
        source: "fixture.ts",
      });
      console.log(x);
      const startOffset = getPositionOffset(
        transpiled!,
        2, // startPosition.line,
        12, // startPosition.column,
      );
      const endOffset = getPositionOffset(
        transpiled!,
        2, // endPosition.line,
        73, // endPosition.column,
      );

      expect(transpiled?.slice(startOffset, endOffset)).toMatchInlineSnapshot(
        `"require("./__generated__/SomeComponentQuery.graphql").default"`,
      );
    });
  });
});
