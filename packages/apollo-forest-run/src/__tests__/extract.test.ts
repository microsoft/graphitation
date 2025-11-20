import { ForestRun } from "../ForestRun";
import { gql } from "./helpers/descriptor";

describe("ForestRun.extract()", () => {
  test("should extract the cache correctly", () => {
    const cache = new ForestRun();
    const query = gql`
      query Foo($i: Int = 0) {
        foo(i: $i)
      }
    `;

    cache.write({ query, result: { foo: 0 } });
    cache.write({ query, result: { foo: 1 }, variables: { i: 1 } });

    expect(cache.extract()).toMatchInlineSnapshot(`
      {
        "query Foo:1": {
          "data": {
            "foo": 0,
          },
          "hasHistory": false,
          "optimisticData": null,
          "variables": {},
        },
        "query Foo:2": {
          "data": {
            "foo": 1,
          },
          "hasHistory": false,
          "optimisticData": null,
          "variables": {
            "i": 1,
          },
        },
      }
    `);
  });

  test("should extract the cache with history when enabled", () => {
    const cache = new ForestRun({
      historyConfig: { enableRichHistory: false, overwrittenHistorySize: 1 },
    });
    const query = gql`
      query Foo($i: Int = 0) {
        foo(i: $i)
      }
    `;
    cache.write({ query, result: { foo: 0 } });
    cache.write({ query, result: { foo: 1 }, variables: { i: 1 } });

    cache.write({ query, result: { foo: 2 } });
    cache.write({ query, result: { foo: 3 }, variables: { i: 1 } });

    expect(cache.extract()).toMatchInlineSnapshot(`
      {
        "query Foo:1": {
          "data": {
            "foo": 2,
          },
          "hasHistory": true,
          "optimisticData": null,
          "variables": {},
        },
        "query Foo:2": {
          "data": {
            "foo": 3,
          },
          "hasHistory": true,
          "optimisticData": null,
          "variables": {
            "i": 1,
          },
        },
      }
    `);
  });

  test("should extract the cache with optimistic data", () => {
    const cache = new ForestRun();
    const query = gql`
      query Foo($i: Int = 0) {
        foo(i: $i)
      }
    `;
    cache.write({ query, result: { foo: 0 } });
    cache.write({ query, result: { foo: 1 }, variables: { i: 1 } });
    cache.recordOptimisticTransaction(() => {
      cache.write({ query, result: { foo: 2 } });
    }, "test");

    expect(cache.extract(true)).toMatchInlineSnapshot(`
      {
        "query Foo:1": {
          "data": {
            "foo": 0,
          },
          "hasHistory": false,
          "optimisticData": {
            "foo": 2,
          },
          "variables": {},
        },
        "query Foo:2": {
          "data": {
            "foo": 1,
          },
          "hasHistory": false,
          "optimisticData": null,
          "variables": {
            "i": 1,
          },
        },
      }
    `);
  });

  test("should extract the cache with optimistic data only", () => {
    const cache = new ForestRun();
    const query = gql`
      query Foo($i: Int = 0) {
        foo(i: $i)
      }
    `;
    cache.recordOptimisticTransaction(() => {
      cache.write({ query, result: { foo: 1 } });
    }, "test");

    expect(cache.extract(true)).toMatchInlineSnapshot(`
      {
        "query Foo:1": {
          "data": null,
          "hasHistory": false,
          "optimisticData": {
            "foo": 1,
          },
          "variables": {},
        },
      }
    `);
  });
});
