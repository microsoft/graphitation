import { RunLoaderResult, runLoaders } from "loader-runner";
import { SourceMapConsumer, MappingItem } from "source-map-js";
import * as fs from "fs";
import * as path from "path";
import { Position } from "source-map-js";

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

function getPositionOffset(str: string, position: Position): number {
  const lines = str.split("\n");
  let offset = 0;
  for (let i = 0; i < position.line - 1; i++) {
    offset += lines[i].length + 1;
  }
  offset += position.column;
  return offset;
}

function getGeneratedCodeForOriginalRange(
  originalStart: Position,
  originalEnd: Position,
  sourceMap: SourceMapConsumer,
  transpiled: string,
): string {
  const generatedStart = sourceMap.generatedPositionFor({
    ...originalStart,
    source: "fixture.ts",
  });
  const generatedEnd = sourceMap.generatedPositionFor({
    ...originalEnd,
    source: "fixture.ts",
  });
  return transpiled.slice(
    getPositionOffset(transpiled, generatedStart),
    getPositionOffset(transpiled, generatedEnd),
  );
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
    {
      name: "invalid documents by not replacing them",
      source: `
        import { graphql } from "@nova/react";
        // some \`graphql\` tag comment
        const {data} = useFragment(
          graphql\`
            fragment SomeComponentFragment on Query {
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

      expect(
        getGeneratedCodeForOriginalRange(
          { line: 3, column: 20 },
          { line: 3, column: 79 },
          consumer,
          transpiled!,
        ),
      ).toMatchInlineSnapshot(
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

      // fs.writeFileSync(__dirname + "/tmp/test.out", transpiled!);
      // fs.writeFileSync(__dirname + "/tmp/test.map", sourceMap!);

      expect(
        getGeneratedCodeForOriginalRange(
          { line: 3, column: 20 },
          { line: 7, column: 9 },
          consumer,
          transpiled!,
        ),
      ).toMatchInlineSnapshot(
        `"require("./__generated__/SomeComponentQuery.graphql").default"`,
      );
    });

    xit("emits source-mapping for the character immediately after a tagged template", async () => {
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

      expect(
        consumer.generatedPositionFor({
          line: 7,
          column: 9,
          source: "fixture.ts",
        }),
      ).toMatchObject({ line: 3, column: 81 });
      // TODO: This is why the assertion below it fails. The column comes back the same as in the above assertion.
      expect(
        consumer.generatedPositionFor({
          line: 7,
          column: 10,
          source: "fixture.ts",
        }),
      ).toMatchObject({ line: 3, column: 82 });
      expect(
        getGeneratedCodeForOriginalRange(
          { line: 7, column: 9 },
          { line: 7, column: 10 },
          consumer,
          transpiled!,
        ),
      ).toMatchInlineSnapshot(`";"`);
    });

    it("emits source-map that expands on existing input map", async () => {
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
      const consumer = new SourceMapConsumer(sourceMap!.toString() as any);

      expect(
        getGeneratedCodeForOriginalRange(
          { line: 5, column: 20 },
          { line: 5, column: 80 },
          consumer,
          transpiled!,
        ),
      ).toMatchInlineSnapshot(
        `"require("./__generated__/SomeComponentQuery.graphql").default"`,
      );
    });
  });
});
