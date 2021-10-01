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
  describe("concerning graphql tagged templates", () => {
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

  it("transforms useFragment hooks", () => {
    const source = `
      export const SomeComponent = ({ query: queryRef }) => {
        const query = useFragment(SomeComponentFragment, queryRef)
        return <div>{query.helloWorld}</div>
      }
    `;
    expect(transform(source)).toMatchInlineSnapshot(`
      import { useWatchQuery as __graphitation_useWatchQuery } from "@graphitation/apollo-react-relay-duct-tape";
      export const SomeComponent = ({ query: queryRef }) => {
          const query = __graphitation_useWatchQuery(SomeComponentFragment, queryRef).data.node;
          return <div>{query.helloWorld}</div>;
      };
    `);
  });

  it("transforms useLazyLoadQuery hooks", () => {
    const source = `
      export const SomeComponent = () => {
        const result = useLazyLoadQuery(SomeComponentQuery, { variables: { id: 42 } })
        return result.data ? <div>{result.data}</div> : null
      }
    `;
    expect(transform(source)).toMatchInlineSnapshot(`
      import { useExecuteAndWatchQuery as __graphitation_useExecuteAndWatchQuery } from "@graphitation/apollo-react-relay-duct-tape";
      export const SomeComponent = () => {
          const result = __graphitation_useExecuteAndWatchQuery(SomeComponentQuery, { variables: { id: 42 } });
          return result.data ? <div>{result.data}</div> : null;
      };
    `);
  });
});
