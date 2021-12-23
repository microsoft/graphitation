import { enableNodeWatchQuery } from "./enableNodeWatchQuery";
import dedent from "dedent";

import { graphql } from "@graphitation/graphql-js-tag";
import { buildASTSchema, print } from "graphql";

const schema = buildASTSchema(graphql`
  interface Node {
    id: ID!
  }

  type User implements Node {
    id: ID!
  }

  type Size {
    id: ID!
  }
`);

describe(enableNodeWatchQuery, () => {
  it("adds Relay's @refetchable directive to fragments on types that implement Node", () => {
    const doc = `
      fragment SomeModule_fooFragment on User {
        id
      }
    `;
    expect(enableNodeWatchQuery(doc, schema).trim()).toEqual(dedent`
      fragment SomeModule_fooFragment on User @refetchable(queryName: "SomeModule_fooWatchNodeQuery") {
        id
      }
    `);
  });

  it("does not add to fragments on non-Node types", () => {
    const doc = `
      fragment SomeModule_fooFragment on Size {
        id
      }
    `;
    expect(enableNodeWatchQuery(doc, schema)).toEqual(`
      fragment SomeModule_fooFragment on Size {
        id
      }
    `);
  });
});
