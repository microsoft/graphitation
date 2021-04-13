import { bar } from ".";

describe("bar", () => {
  it("returns a string", () => {
    expect(typeof bar("test")).toBe("string");
  });
});
