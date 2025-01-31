import { ForestRun } from "../ForestRun";
import { gql } from "./helpers/descriptor";

it("evicts data automatically by default", () => {
  const cache = new ForestRun({
    maxOperationCount: 1,
  });
  const query = gql`
    query ($i: Int) {
      foo(i: $i)
    }
  `;

  cache.write({ query, variables: { i: 0 }, result: { foo: 0 } });
  cache.write({ query, variables: { i: 1 }, result: { foo: 1 } });
  cache.write({ query, variables: { i: 2 }, result: { foo: 2 } });

  const result0 = cache.read({ query, variables: { i: 0 }, optimistic: true });
  const result1 = cache.read({ query, variables: { i: 1 }, optimistic: true });
  const result2 = cache.read({ query, variables: { i: 2 }, optimistic: true });

  expect(result0).toEqual(null);
  expect(result1).toEqual(null);
  expect(result2).toEqual({ foo: 2 });
});

it("allows disabling automatic eviction", () => {
  const cache = new ForestRun({
    maxOperationCount: 1,
    autoEvict: false,
  });
  const query = gql`
    query ($i: Int) {
      foo(i: $i)
    }
  `;

  cache.write({ query, variables: { i: 0 }, result: { foo: 0 } });
  cache.write({ query, variables: { i: 1 }, result: { foo: 1 } });
  cache.write({ query, variables: { i: 2 }, result: { foo: 2 } });

  const result0 = cache.read({ query, variables: { i: 0 }, optimistic: true });
  const result1 = cache.read({ query, variables: { i: 1 }, optimistic: true });
  const result2 = cache.read({ query, variables: { i: 2 }, optimistic: true });

  expect(result0).toEqual({ foo: 0 });
  expect(result1).toEqual({ foo: 1 });
  expect(result2).toEqual({ foo: 2 });
});

it("allows manual eviction", () => {
  const cache = new ForestRun({
    maxOperationCount: 1,
    autoEvict: false,
  });
  const query = gql`
    query ($i: Int) {
      foo(i: $i)
    }
  `;

  cache.write({ query, variables: { i: 0 }, result: { foo: 0 } });
  cache.write({ query, variables: { i: 1 }, result: { foo: 1 } });
  cache.write({ query, variables: { i: 2 }, result: { foo: 2 } });

  cache.gc();

  const result0 = cache.read({ query, variables: { i: 0 }, optimistic: true });
  const result1 = cache.read({ query, variables: { i: 1 }, optimistic: true });
  const result2 = cache.read({ query, variables: { i: 2 }, optimistic: true });

  expect(result0).toEqual(null);
  expect(result1).toEqual(null);
  expect(result2).toEqual({ foo: 2 });
});

it("doesn't evict watched old operations", () => {
  const cache = new ForestRun({
    maxOperationCount: 1,
    autoEvict: false,
  });
  const query = gql`
    query ($i: Int) {
      foo(i: $i)
    }
  `;

  cache.watch({
    query,
    variables: { i: 1 },
    optimistic: true,
    callback: () => {},
  });

  cache.write({ query, variables: { i: 0 }, result: { foo: 0 } });
  cache.write({ query, variables: { i: 1 }, result: { foo: 1 } });
  cache.write({ query, variables: { i: 2 }, result: { foo: 2 } });

  cache.gc();

  const result0 = cache.read({ query, variables: { i: 0 }, optimistic: true });
  const result1 = cache.read({ query, variables: { i: 1 }, optimistic: true });
  const result2 = cache.read({ query, variables: { i: 2 }, optimistic: true });

  expect(result0).toEqual(null);
  expect(result1).toEqual({ foo: 1 });
  expect(result2).toEqual({ foo: 2 });
});

it("allows to opt out operations from eviction", () => {
  const cache = new ForestRun({
    maxOperationCount: 1,
    autoEvict: false,
    nonEvictableQueries: new Set(["b"]), // root-level field
  });
  const a = gql`
    {
      a
    }
  `;
  const b = gql`
    {
      b
    }
  `;
  const c = gql`
    {
      c
    }
  `;

  cache.write({ query: a, result: { a: 0 } });
  cache.write({ query: b, result: { b: 1 } });
  cache.write({ query: c, result: { c: 2 } });

  cache.gc();

  const result0 = cache.read({ query: a, optimistic: true });
  const result1 = cache.read({ query: b, optimistic: true });
  const result2 = cache.read({ query: c, optimistic: true });

  expect(result0).toEqual(null);
  expect(result1).toEqual({ b: 1 });
  expect(result2).toEqual({ c: 2 });
});
