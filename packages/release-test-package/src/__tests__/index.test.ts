import { getReleaseTestMessage } from "../index";

describe("getReleaseTestMessage", () => {
  it("returns the release test message", () => {
    expect(getReleaseTestMessage()).toBe("Graphitation release test package");
  });
});
