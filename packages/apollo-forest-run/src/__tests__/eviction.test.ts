import { ForestRun } from "../ForestRun";
import { gql } from "./helpers/descriptor";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

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

  jest.runAllTimers();

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

  jest.runAllTimers();

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
    unstable_partitionConfig: {
      partitionKey: (o) => o.operation.debugName,
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

it("should warn exactly once for the same warning", () => {
  const mockConsole = {
    ...console,
    warn: jest.fn(),
  };

  const cache = new ForestRun({
    maxOperationCount: 1,
    autoEvict: false,
    logger: mockConsole,
    unstable_partitionConfig: {
      partitionKey: (o) => o.operation.debugName,
      partitions: {},
    },
  });

  cache.write({
    query: gql`
      query TestA {
        test
      }
    `,
    result: { test: "value" },
  });

  cache.write({
    query: gql`
      query TestB {
        test
      }
    `,
    result: { test: "new value" },
  });

  cache.gc();

  expect(mockConsole.warn).toHaveBeenCalledTimes(1);
  expect(mockConsole.warn).toHaveBeenCalledWith(
    "partition_not_configured",
    'Partition "query TestA" is not configured in partitionConfig. Using default partition instead.',
  );

  // notably: "query TestB" is NOT logged
});

it("auto-evicts all partitions when global autoEvict is true", () => {
  const cache = new ForestRun({
    maxOperationCount: 1,
    autoEvict: true,
    unstable_partitionConfig: {
      partitionKey: (o) => o.operation.debugName,
      partitions: {
        "query a": { maxOperationCount: 1 },
        "query b": { maxOperationCount: 1 },
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

  cache.write({ query: a, variables: { i: 0 }, result: { foo: 0 } });
  cache.write({ query: a, variables: { i: 1 }, result: { foo: 1 } });
  cache.write({ query: a, variables: { i: 2 }, result: { foo: 2 } });
  cache.write({ query: b, variables: { i: 0 }, result: { bar: 0 } });
  cache.write({ query: b, variables: { i: 1 }, result: { bar: 1 } });
  cache.write({ query: b, variables: { i: 2 }, result: { bar: 2 } });

  jest.runAllTimers();

  // Both partitions should be auto-evicted (global autoEvict: true)
  expect(
    cache.read({ query: a, variables: { i: 0 }, optimistic: true }),
  ).toEqual(null);
  expect(
    cache.read({ query: a, variables: { i: 2 }, optimistic: true }),
  ).toEqual({ foo: 2 });
  expect(
    cache.read({ query: b, variables: { i: 0 }, optimistic: true }),
  ).toEqual(null);
  expect(
    cache.read({ query: b, variables: { i: 2 }, optimistic: true }),
  ).toEqual({ bar: 2 });
});

it("per-partition autoEvict: false prevents auto-eviction for that partition when global autoEvict is true", () => {
  const cache = new ForestRun({
    maxOperationCount: 1,
    autoEvict: true,
    unstable_partitionConfig: {
      partitionKey: (o) => o.operation.debugName,
      partitions: {
        "query a": { maxOperationCount: 1, autoEvict: true },
        "query b": { maxOperationCount: 1, autoEvict: false },
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

  cache.write({ query: a, variables: { i: 0 }, result: { foo: 0 } });
  cache.write({ query: a, variables: { i: 1 }, result: { foo: 1 } });
  cache.write({ query: a, variables: { i: 2 }, result: { foo: 2 } });
  cache.write({ query: b, variables: { i: 0 }, result: { bar: 0 } });
  cache.write({ query: b, variables: { i: 1 }, result: { bar: 1 } });
  cache.write({ query: b, variables: { i: 2 }, result: { bar: 2 } });

  jest.runAllTimers();

  // Partition "a" should be auto-evicted (autoEvict: true)
  expect(
    cache.read({ query: a, variables: { i: 0 }, optimistic: true }),
  ).toEqual(null);
  expect(
    cache.read({ query: a, variables: { i: 2 }, optimistic: true }),
  ).toEqual({ foo: 2 });
  // Partition "b" should NOT be auto-evicted (autoEvict: false overrides global)
  expect(
    cache.read({ query: b, variables: { i: 0 }, optimistic: true }),
  ).toEqual({ bar: 0 });
  expect(
    cache.read({ query: b, variables: { i: 2 }, optimistic: true }),
  ).toEqual({ bar: 2 });
});

it("auto-evicts partitions with autoEvict: true even when global autoEvict is false", () => {
  const cache = new ForestRun({
    maxOperationCount: 1,
    autoEvict: false,
    unstable_partitionConfig: {
      partitionKey: (o) => o.operation.debugName,
      partitions: {
        "query a": { maxOperationCount: 1, autoEvict: true },
        "query b": { maxOperationCount: 1 },
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

  cache.write({ query: a, variables: { i: 0 }, result: { foo: 0 } });
  cache.write({ query: a, variables: { i: 1 }, result: { foo: 1 } });
  cache.write({ query: a, variables: { i: 2 }, result: { foo: 2 } });
  cache.write({ query: b, variables: { i: 0 }, result: { bar: 0 } });
  cache.write({ query: b, variables: { i: 1 }, result: { bar: 1 } });
  cache.write({ query: b, variables: { i: 2 }, result: { bar: 2 } });

  jest.runAllTimers();

  // Partition "a" auto-evicted (autoEvict: true)
  const resultA0 = cache.read({
    query: a,
    variables: { i: 0 },
    optimistic: true,
  });
  const resultA2 = cache.read({
    query: a,
    variables: { i: 2 },
    optimistic: true,
  });
  // Partition "b" NOT auto-evicted (inherits global autoEvict: false)
  const resultB0 = cache.read({
    query: b,
    variables: { i: 0 },
    optimistic: true,
  });
  const resultB2 = cache.read({
    query: b,
    variables: { i: 2 },
    optimistic: true,
  });

  expect(resultA0).toEqual(null); // evicted
  expect(resultA2).toEqual({ foo: 2 }); // kept
  expect(resultB0).toEqual({ bar: 0 }); // NOT evicted (inherits global false)
  expect(resultB2).toEqual({ bar: 2 }); // kept
});

it("gc() evicts all partitions regardless of per-partition autoEvict", () => {
  const cache = new ForestRun({
    maxOperationCount: 1,
    autoEvict: false,
    unstable_partitionConfig: {
      partitionKey: (o) => o.operation.debugName,
      partitions: {
        "query a": { maxOperationCount: 1, autoEvict: false },
        "query b": { maxOperationCount: 1, autoEvict: false },
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

  cache.write({ query: a, variables: { i: 0 }, result: { foo: 0 } });
  cache.write({ query: a, variables: { i: 1 }, result: { foo: 1 } });
  cache.write({ query: b, variables: { i: 0 }, result: { bar: 0 } });
  cache.write({ query: b, variables: { i: 1 }, result: { bar: 1 } });

  // No auto-eviction should have happened (all 4 entries still present)
  expect(cache.getStats().treeCount).toBe(4);

  // Manual gc() should evict all partitions regardless of autoEvict: false
  cache.gc();

  // Each partition had 2 items with maxOperationCount: 1, so oldest evicted from each
  // a/i=0 (oldest) evicted, a/i=1 (newest) kept
  // b/i=0 (oldest) evicted, b/i=1 (newest) kept
  expect(
    cache.read({ query: a, variables: { i: 0 }, optimistic: true }),
  ).toEqual(null);
  expect(
    cache.read({ query: a, variables: { i: 1 }, optimistic: true }),
  ).toEqual({ foo: 1 });
  expect(
    cache.read({ query: b, variables: { i: 0 }, optimistic: true }),
  ).toEqual(null);
  expect(
    cache.read({ query: b, variables: { i: 1 }, optimistic: true }),
  ).toEqual({ bar: 1 });
});

it("per-partition autoEvict: true overrides global autoEvict: false for default partition", () => {
  // autoEvict: false only applies to __default__ partition and partitions
  // that don't specify their own autoEvict
  const cache = new ForestRun({
    maxOperationCount: 1,
    autoEvict: false,
    unstable_partitionConfig: {
      partitionKey: (o) => o.operation.debugName,
      partitions: {
        "query a": { maxOperationCount: 1, autoEvict: true },
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

  cache.write({ query: a, variables: { i: 0 }, result: { foo: 0 } });
  cache.write({ query: a, variables: { i: 1 }, result: { foo: 1 } });
  cache.write({ query: a, variables: { i: 2 }, result: { foo: 2 } });
  // "query b" is not configured, goes to __default__ partition
  cache.write({ query: b, variables: { i: 0 }, result: { bar: 0 } });
  cache.write({ query: b, variables: { i: 1 }, result: { bar: 1 } });
  cache.write({ query: b, variables: { i: 2 }, result: { bar: 2 } });

  jest.runAllTimers();

  // Partition "a" auto-evicted (autoEvict: true)
  expect(
    cache.read({ query: a, variables: { i: 0 }, optimistic: true }),
  ).toEqual(null);
  expect(
    cache.read({ query: a, variables: { i: 2 }, optimistic: true }),
  ).toEqual({ foo: 2 });
  // Default partition NOT auto-evicted (inherits global autoEvict: false)
  expect(
    cache.read({ query: b, variables: { i: 0 }, optimistic: true }),
  ).toEqual({ bar: 0 });
  expect(
    cache.read({ query: b, variables: { i: 2 }, optimistic: true }),
  ).toEqual({ bar: 2 });
});
