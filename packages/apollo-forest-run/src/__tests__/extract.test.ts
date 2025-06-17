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
          "optimisticData": null,
          "variables": {},
        },
        "query Foo:2": {
          "data": {
            "foo": 1,
          },
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
          "optimisticData": {
            "foo": 2,
          },
          "variables": {},
        },
        "query Foo:2": {
          "data": {
            "foo": 1,
          },
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
          "optimisticData": {
            "foo": 1,
          },
          "variables": {},
        },
      }
    `);
  });
});
