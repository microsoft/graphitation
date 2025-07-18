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

it("allows partitioned eviction", () => {
  // query a and b have their own partitions, so they can be evicted independently
  // query c and d do not have their own partitions, so they will be evicted together
  // as part of the default partition
  const cache = new ForestRun({
    maxOperationCount: 1,
    autoEvict: false,
    partitionConfig: {
      partitionKey: (o) => o.debugName,
      partitions: {
        "query a": { maxOperationCount: 1 },
        "query b": { maxOperationCount: 2 },
      },
    },
  });
  const a = gql`
    query a($i: Int) {
      foo(i: $i)
    }
  `;

  const b = gql`
    query b($i: Int) {
      bar(i: $i)
    }
  `;

  const c = gql`
    query c($i: Int) {
      baz(i: $i)
    }
  `;

  const d = gql`
    query d($i: Int) {
      qux(i: $i)
    }
  `;

  cache.write({ query: a, variables: { i: 0 }, result: { foo: 0 } });
  cache.write({ query: a, variables: { i: 1 }, result: { foo: 1 } });
  cache.write({ query: a, variables: { i: 2 }, result: { foo: 2 } });
  cache.write({ query: b, variables: { i: 0 }, result: { bar: 0 } });
  cache.write({ query: b, variables: { i: 1 }, result: { bar: 1 } });
  cache.write({ query: b, variables: { i: 2 }, result: { bar: 2 } });
  cache.write({ query: c, variables: { i: 0 }, result: { baz: 0 } });
  cache.write({ query: c, variables: { i: 1 }, result: { baz: 1 } });
  cache.write({ query: d, variables: { i: 0 }, result: { qux: 0 } });
  cache.write({ query: d, variables: { i: 1 }, result: { qux: 1 } });

  cache.gc();

  const resultA0 = cache.read({
    query: a,
    variables: { i: 0 },
    optimistic: true,
  });
  const resultA1 = cache.read({
    query: a,
    variables: { i: 1 },
    optimistic: true,
  });
  const resultA2 = cache.read({
    query: a,
    variables: { i: 2 },
    optimistic: true,
  });
  const resultB0 = cache.read({
    query: b,
    variables: { i: 0 },
    optimistic: true,
  });
  const resultB1 = cache.read({
    query: b,
    variables: { i: 1 },
    optimistic: true,
  });
  const resultB2 = cache.read({
    query: b,
    variables: { i: 2 },
    optimistic: true,
  });
  const resultC0 = cache.read({
    query: c,
    variables: { i: 0 },
    optimistic: true,
  });
  const resultC1 = cache.read({
    query: c,
    variables: { i: 1 },
    optimistic: true,
  });
  const resultD0 = cache.read({
    query: d,
    variables: { i: 0 },
    optimistic: true,
  });
  const resultD1 = cache.read({
    query: d,
    variables: { i: 1 },
    optimistic: true,
  });

  expect(resultA0).toEqual(null);
  expect(resultA1).toEqual(null);
  expect(resultA2).toEqual({ foo: 2 });
  expect(resultB0).toEqual(null);
  expect(resultB1).toEqual({ bar: 1 });
  expect(resultB2).toEqual({ bar: 2 });
  expect(resultC0).toEqual(null);
  expect(resultC1).toEqual(null);
  expect(resultD0).toEqual(null);
  expect(resultD1).toEqual({ qux: 1 });
});
