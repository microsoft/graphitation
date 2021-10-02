import * as ts from "typescript";
import { createWatchNodeQueryTransform } from "./createWatchNodeQueryTransform";

expect.addSnapshotSerializer({
  test: (val) => typeof val === "string",
  print: (val) => {
    return (val as string).trimRight();
  },
});

function transform(sourceText: string): string {
  const sourceFile = ts.createSourceFile(
    "SomeComponent.tsx",
    sourceText,
    ts.ScriptTarget.Latest
  );
  const result = ts.transform(sourceFile, [createWatchNodeQueryTransform()]);
  const printer = ts.createPrinter();
  return printer.printFile(result.transformed[0]);
}

describe(createWatchNodeQueryTransform, () => {
  it("works with documents without interpolation", () => {
    const source = `
      const doc = graphql\`
        fragment SomeComponentFragment on Query {
          helloWorld
        }
      \`
    `;
    expect(transform(source)).toMatchInlineSnapshot(`
      import * as __graphitation_generatedQueries_SomeComponentFragment from "./__generated__/SomeComponentWatchNodeQuery.graphql";
      const doc = __graphitation_generatedQueries_SomeComponentFragment;
    `);
  });

  it("works with documents with interpolation", () => {
    const source = `
      const doc = graphql\`
        query SomeComponentQuery($id: ID!) {
          helloWorld
          ...SomeOtherComponentFragment
        }
        \${SomeOtherComponentFragment}
      \`
    `;
    expect(transform(source)).toMatchInlineSnapshot(`
      import * as __graphitation_generatedQueries_SomeComponentQuery from "./__generated__/SomeComponentQuery.graphql";
      const doc = __graphitation_generatedQueries_SomeComponentQuery;
    `);
  });
});
