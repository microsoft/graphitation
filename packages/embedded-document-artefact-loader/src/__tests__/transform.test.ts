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
});
