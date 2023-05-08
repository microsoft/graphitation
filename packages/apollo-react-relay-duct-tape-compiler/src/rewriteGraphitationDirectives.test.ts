import { rewriteGraphitationDirectives } from "./rewriteGraphitationDirectives";
import dedent from "dedent";

describe(rewriteGraphitationDirectives, () => {
  it("rewrites @watchNode to Relay's @refetchable", () => {
    const doc = `
      fragment SomeModule_fooFragment on User @watchNode {
        name
      }
    `;
    expect(rewriteGraphitationDirectives(doc).trim()).toEqual(dedent`
      fragment SomeModule_fooFragment on User @refetchable(queryName: "SomeModule_fooWatchNodeQuery") {
        name
      }
    `);
  });
});
