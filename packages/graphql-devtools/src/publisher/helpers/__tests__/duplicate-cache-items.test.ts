import { getClientCacheDuplicates } from "../duplicate-cache-items";

describe(".getClientCacheDuplicates", () => {
  it("detecting duplicate keys in specific category (part of the cache item key before ':')", () => {
    expect(
      getClientCacheDuplicates(
        {
          ROOT_QUERY: { test: 123 },
          "car:123": { id: "1", testProperty: "test" },
          "car:456": { id: "2", testProperty: "test" },
          "car:756": { id: "3", testProperty2: "test2" },
          "car:856": { id: "4", testProperty: "test", anotherProperty: 2 },
          "car:556": { id: "5", testProperty: "test" },
          "car:656": { id: "6", testProperty: "test2" },
          "ship:123": { id: "7", testProperty: "test" },
          "ship:456": { id: "8", testProperty: { nestedProperty: "test" } },
          "ship:556": { id: "9", testProperty: { nestedProperty: "test" } },

          "hatak:456": {
            objectId: "10",
            secondId: "8",
            testProperty: { nestedProperty: "test" },
          },
          "hatak:556": {
            objectId: "9",
            secondId: "11",
            testProperty: { nestedProperty: "test" },
          },
        },
        { hatak: ["objectId", "secondId"] }
      )
    ).toMatchObject([
      [
        { "car:123": { id: "1", testProperty: "test" } },
        { "car:456": { id: "2", testProperty: "test" } },
        { "car:556": { id: "5", testProperty: "test" } },
      ],
      [
        { "ship:456": { id: "8", testProperty: { nestedProperty: "test" } } },
        { "ship:556": { id: "9", testProperty: { nestedProperty: "test" } } },
      ],
      [
        {
          "hatak:456": {
            objectId: "10",
            secondId: "8",
            testProperty: { nestedProperty: "test" },
          },
        },
        {
          "hatak:556": {
            objectId: "9",
            secondId: "11",
            testProperty: { nestedProperty: "test" },
          },
        },
      ],
    ]);
  });
});
