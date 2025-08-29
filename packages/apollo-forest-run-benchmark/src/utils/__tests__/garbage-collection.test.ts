import { GarbageCollector } from "../garbage-collection";

describe("GarbageCollector", () => {
  it("should collect unused objects", () => {
    const gc = new GarbageCollector();
    gc.collect();
    expect(gc.getStats().runs).toBe(1);
  });
});
