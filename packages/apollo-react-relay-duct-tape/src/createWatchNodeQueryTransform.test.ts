// import { createCompilerHost, createProgram } from "typescript";
import * as ts from "typescript";
import { createWatchNodeQueryTransform } from "./createWatchNodeQueryTransform";

describe(createWatchNodeQueryTransform, () => {
  it("transforms useFragment hooks", () => {
    const sourceText = `
      const SomeComponentFragment = graphql\`
        fragment SomeComponentFragment on Query {
          helloWorld
        }
      \`
      export const SomeComponent = ({ query: queryRef }) => {
        const query = useFragment(SomeComponentFragment, queryRef)
        return <div>{query.helloWorld}</div>
      }
    `;
    const sourceFile = ts.createSourceFile(
      "SomeComponent.tsx",
      sourceText,
      ts.ScriptTarget.Latest
    );
    const result = ts.transform(sourceFile, [createWatchNodeQueryTransform()]);
    const printer = ts.createPrinter();
    expect(printer.printFile(result.transformed[0])).toMatchInlineSnapshot(`
      "import * as __graphitation_generatedQueries_SomeComponentFragment from \\"./__generated__/SomeComponentWatchNodeQuery.graphql\\";
      import { useWatchQuery as __graphitation_useWatchQuery } from \\"@graphitation/apollo-react-relay-duct-tape\\";
      const SomeComponentFragment = __graphitation_generatedQueries_SomeComponentFragment;
      export const SomeComponent = ({ query: queryRef }) => {
          const query = __graphitation_useWatchQuery(SomeComponentFragment, queryRef).data.node;
          return <div>{query.helloWorld}</div>;
      };
      "
    `);
  });

  it("works with documents without interpolation", () => {
    const sourceText = `
      const SomeComponentQuery = graphql\`
        query SomeComponentQuery($id: ID!) {
          helloWorld
        }
      \`
      export const SomeComponent = () => {
        const result = useLazyLoadQuery(SomeComponentQuery, { variables: { id: 42 } })
        return result.data ? <div>{result.data}</div> : null
      }
    `;
    const sourceFile = ts.createSourceFile(
      "SomeComponent.tsx",
      sourceText,
      ts.ScriptTarget.Latest
    );
    const result = ts.transform(sourceFile, [createWatchNodeQueryTransform()]);
    const printer = ts.createPrinter();
    expect(printer.printFile(result.transformed[0])).toMatchInlineSnapshot(`
      "import * as __graphitation_generatedQueries_SomeComponentQuery from \\"./__generated__/SomeComponentQuery.graphql\\";
      import { useExecuteAndWatchQuery as __graphitation_useExecuteAndWatchQuery } from \\"@graphitation/apollo-react-relay-duct-tape\\";
      const SomeComponentQuery = __graphitation_generatedQueries_SomeComponentQuery;
      export const SomeComponent = () => {
          const result = __graphitation_useExecuteAndWatchQuery(SomeComponentQuery, { variables: { id: 42 } });
          return result.data ? <div>{result.data}</div> : null;
      };
      "
    `);
  });

  it("works with documents with interpolation", () => {
    const sourceText = `
      const SomeOtherComponentFragment = graphql\`
        fragment SomeOtherComponentFragment on Query {
          helloWorld
        }
      \`
      const SomeComponentQuery = graphql\`
        query SomeComponentQuery($id: ID!) {
          helloWorld
          ...SomeOtherComponentFragment
        }
        \${SomeOtherComponentFragment}
      \`
      export const SomeComponent = () => {
        const result = useLazyLoadQuery(SomeComponentQuery, { variables: { id: 42 } })
        return result.data ? <div>{result.data}</div> : null
      }
    `;
    const sourceFile = ts.createSourceFile(
      "SomeComponent.tsx",
      sourceText,
      ts.ScriptTarget.Latest
    );
    const result = ts.transform(sourceFile, [createWatchNodeQueryTransform()]);
    const printer = ts.createPrinter();
    expect(printer.printFile(result.transformed[0])).toMatchInlineSnapshot(`
      "import * as __graphitation_generatedQueries_SomeOtherComponentFragment from \\"./__generated__/SomeOtherComponentWatchNodeQuery.graphql\\";
      import * as __graphitation_generatedQueries_SomeComponentQuery from \\"./__generated__/SomeComponentQuery.graphql\\";
      import { useExecuteAndWatchQuery as __graphitation_useExecuteAndWatchQuery } from \\"@graphitation/apollo-react-relay-duct-tape\\";
      const SomeOtherComponentFragment = __graphitation_generatedQueries_SomeOtherComponentFragment;
      const SomeComponentQuery = __graphitation_generatedQueries_SomeComponentQuery;
      export const SomeComponent = () => {
          const result = __graphitation_useExecuteAndWatchQuery(SomeComponentQuery, { variables: { id: 42 } });
          return result.data ? <div>{result.data}</div> : null;
      };
      "
    `);
  });
});
