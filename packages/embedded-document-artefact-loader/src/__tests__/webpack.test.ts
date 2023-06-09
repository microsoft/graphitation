import { RunLoaderResult, runLoaders } from "loader-runner";
import { SourceMapConsumer } from "source-map";

function runLoader(source: string, context?: { sourceMap: boolean }) {
  return new Promise<RunLoaderResult>((resolve, reject) => {
    runLoaders(
      {
        resource: "/path/to/index.js",
        loaders: [
          {
            loader: require.resolve("../webpack.ts"),
            options: {},
          },
        ],
        context: {
          sourceMap: context?.sourceMap ?? true,
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
        source: "/path/to/index.js",
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
        source: "/path/to/index.js",
      });
      const endPosition = consumer.generatedPositionFor({
        line: 7,
        column: 10,
        source: "/path/to/index.js",
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
  });
});
