import { transform } from "../transform";
import { SourceMapGenerator } from "source-map-js";

describe("transform", () => {
  it("should do no work if there are no embedded documents", () => {
    const source = `
      import { graphql } from "@nova/react";
      console.log()
    `;
    const sourceMapGenerator = new SourceMapGenerator();

    expect(transform(source, "somepath", sourceMapGenerator)).toBeUndefined();
    expect(sourceMapGenerator.toString()).toMatchInlineSnapshot(
      `"{"version":3,"sources":["somepath"],"names":[],"mappings":"AAAA"}"`,
    );
  });

  it("should rewrite the document import", () => {
    const source = `
      import { graphql } from "@nova/react";
      
      graphql\`
        fragment MyFragment on MyType {
          id
        }
      \`;
    `;
    const sourceMapGenerator = new SourceMapGenerator();

    expect(transform(source, "somepath", sourceMapGenerator))
      .toMatchInlineSnapshot(`
      "
            import { graphql } from "@nova/react";
            
            require("./__generated__/MyFragment.graphql").default;
          "
    `);
    expect(sourceMapGenerator.toString()).toMatchInlineSnapshot(
      `"{"version":3,"sources":["somepath"],"names":[],"mappings":"AAAA;AACA;AACA;AACA,MAAM,AACN,AACA,AACA,AACA,qDAAO;AACP"}"`,
    );
  });

  it("should rewrite the document import to `artifactDirectory`", () => {
    const source = `
      import { graphql } from "@nova/react";
      
      graphql\`
        fragment MyFragment on MyType {
          id
        }
      \`;
    `;
    const sourceMapGenerator = new SourceMapGenerator();

    expect(
      transform(source, "somepath", sourceMapGenerator, {
        artifactDirectory: "../../__generated__",
      }),
    ).toMatchInlineSnapshot(`
      "
            import { graphql } from "@nova/react";
            
            require("../../__generated__/MyFragment.graphql").default;
          "
    `);
    expect(sourceMapGenerator.toString()).toMatchInlineSnapshot(
      `"{"version":3,"sources":["somepath"],"names":[],"mappings":"AAAA;AACA;AACA;AACA,MAAM,AACN,AACA,AACA,AACA,yDAAO;AACP"}"`,
    );
  });

  it("should rewrite the document import to default when `artifactDirectory` is undefined", () => {
    const source = `
      import { graphql } from "@nova/react";
      
      graphql\`
        fragment MyFragment on MyType {
          id
        }
      \`;
    `;
    const sourceMapGenerator = new SourceMapGenerator();

    expect(
      transform(source, "somepath", sourceMapGenerator, {
        artifactDirectory: undefined,
      }),
    ).toMatchInlineSnapshot(`
      "
            import { graphql } from "@nova/react";
            
            require("undefined/MyFragment.graphql").default;
          "
    `);
    expect(sourceMapGenerator.toString()).toMatchInlineSnapshot(
      `"{"version":3,"sources":["somepath"],"names":[],"mappings":"AAAA;AACA;AACA;AACA,MAAM,AACN,AACA,AACA,AACA,+CAAO;AACP"}"`,
    );
  });
});
