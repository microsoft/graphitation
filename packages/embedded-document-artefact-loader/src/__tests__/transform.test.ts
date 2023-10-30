import { transform } from "../transform";

describe("transform", () => {
  it("should do no work if there are no embedded documents", () => {
    const source = `
      import { graphql } from "@nova/react";
      console.log()
    `;
    expect(transform(source, "somepath", undefined)).toBeUndefined();
  });
});
