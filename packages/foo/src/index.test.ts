import { foo } from ".";

describe("foo", () => {
  it("returns a string", () => {
    expect(typeof foo("test")).toBe("string");
  });
});
