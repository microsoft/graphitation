import type { ForestRun } from "@graphitation/apollo-forest-run";
import type { Scenario, ScenarioContext } from "./types";
import { parse } from "graphql";
import type { DocumentNode } from "graphql";

// Pre-parse 50 unique named queries to simulate a real app with many active operations.
// Each has its own operation name and data, creating separate trees in the forest.
// This is the setup that exposes O(n) scans in getCoveringOperationIds.
const EXTRA_OPS_COUNT = 50;
const extraOperations = Array.from({ length: EXTRA_OPS_COUNT }, (_, i) => ({
  query: parse(`query BgQuery${i} { node${i}(id: "${i}") { id value } }`),
  data: { [`node${i}`]: { __typename: `Node${i}`, id: `${i}`, value: i } },
}));

// N messages x N "hooks", each hook selects a single field of `Message:i` via `message(id)`.
const PENDING_SIZE = 20;
const pendingHookQueries = Array.from({ length: PENDING_SIZE }, (_, h) =>
  parse(`query Hook${h}($id: ID!) { message(id: $id) { id field${h} } }`),
);
const pendingHookResult = (m: number, h: number) => ({
  message: { __typename: "Message", id: String(m), [`field${h}`]: h },
});

const addWatchers = (
  watcherCount: number,
  cache: ForestRun,
  query: any,
  variables?: unknown,
) => {
  const unsubscribes: Array<() => void> = [];
  for (let i = 0; i < watcherCount; i++) {
    const unsub = cache.watch({
      query,
      variables,
      optimistic: true,
      callback: () => {},
    });
    unsubscribes.push(unsub);
  }
  return unsubscribes;
};

// @defer: subsequent results of incremental delivery (the 2022 draft format: `{ incremental, hasNext }`)
type IncrementalResult = {
  path: Array<string | number>;
  label?: string;
  data: Record<string, unknown>;
};
type SubsequentResult = {
  incremental: IncrementalResult[];
  hasNext: boolean;
};

const toSubsequentResults = (
  incremental: IncrementalResult[],
  payloadCount: number,
): SubsequentResult[] => {
  const size = Math.ceil(incremental.length / payloadCount);
  return Array.from({ length: payloadCount }, (_, i) => ({
    incremental: incremental.slice(i * size, (i + 1) * size),
    hasNext: i < payloadCount - 1,
  }));
};

// Objects and arrays of result data
type Composite = Record<string | number, unknown>;

const isComposite = (value: unknown): value is Composite =>
  value !== null && typeof value === "object";

// Merges incremental results into result data outside the cache, as Apollo Client does
// (copy-on-write deep merge, each object is copied at most once per merge, like Apollo's DeepMerger)
const mergeIncrementalData = (
  data: Record<string, unknown>,
  incremental: IncrementalResult[],
): Record<string, unknown> => {
  const copies = new Set<object>();
  const merge = (target: unknown, source: unknown): unknown => {
    if (!isComposite(target) || !isComposite(source)) {
      return source;
    }
    let result = target;
    if (!copies.has(target)) {
      result = (
        Array.isArray(target) ? [...target] : { ...target }
      ) as Composite;
      copies.add(result);
    }
    for (const key of Object.keys(source)) {
      result[key] = merge(result[key], source[key]);
    }
    return result;
  };
  let result: unknown = data;
  for (const { path, data: patch } of incremental) {
    let nested: unknown = patch;
    for (let i = path.length - 1; i >= 0; i--) {
      const parent = (typeof path[i] === "number" ? [] : {}) as Composite;
      parent[path[i]] = nested;
      nested = parent;
    }
    result = merge(result, nested);
  }
  return result as Record<string, unknown>;
};

/**
 * Writes the initial result (outside of measurement) and returns a function writing all subsequent results.
 *
 * Uses `writeExecutionResult` when available. Otherwise (baseline versions without it) emulates Apollo Client:
 * incremental results are merged into the result data outside the cache and the merged data is written with `write`.
 * Both paths make the same number of cache calls.
 */
const prepareIncrementalWrites = (
  cache: ForestRun,
  query: DocumentNode,
  variables: Record<string, unknown>,
  initialData: Record<string, unknown>,
  subsequentResults: SubsequentResult[],
) => {
  if (typeof cache.writeExecutionResult === "function") {
    cache.writeExecutionResult({
      query,
      variables,
      execution: { data: initialData, hasNext: true },
    });
    return () => {
      for (const execution of subsequentResults) {
        cache.writeExecutionResult({ query, variables, execution });
      }
    };
  }
  cache.write({ query, variables, result: initialData });
  return () => {
    let result = initialData;
    for (const { incremental } of subsequentResults) {
      result = mergeIncrementalData(result, incremental);
      cache.write({ query, variables, result });
    }
  };
};

export const scenarios = [
  {
    name: "cold-write",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration, watcherCount } = ctx;
      const cache = new CacheFactory(configuration);

      const { data, query } = operations["complex-nested"];
      addWatchers(watcherCount, cache, query);

      return {
        run() {
          return cache.writeQuery({ query, data: data["complex-nested"] });
        },
      };
    },
  },
  {
    name: "write-no-changes",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration, watcherCount } = ctx;
      const cache = new CacheFactory(configuration);

      const { data, query } = operations["complex-nested"];
      addWatchers(watcherCount, cache, query);
      cache.writeQuery({ query, data: data["complex-nested"] });

      return {
        run() {
          return cache.writeQuery({ query, data: data["complex-nested"] });
        },
      };
    },
  },
  {
    name: "write-one-field-change",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration, watcherCount } = ctx;
      const cache = new CacheFactory(configuration);

      const { data, query } = operations["complex-nested"];
      addWatchers(watcherCount, cache, query);
      cache.writeQuery({ query, data: data["complex-nested"] });

      return {
        run() {
          return cache.writeQuery({
            query,
            data: data["complex-nested-single-field-change"],
          });
        },
      };
    },
  },
  {
    name: "write-changes-in-all-objects",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration, watcherCount } = ctx;
      const cache = new CacheFactory(configuration);

      const { data, query } = operations["complex-nested"];
      addWatchers(watcherCount, cache, query);
      cache.writeQuery({ query, data: data["complex-nested"] });

      return {
        run() {
          return cache.writeQuery({
            query,
            data: data["complex-nested-changes-in-all-objects"],
          });
        },
      };
    },
  },
  {
    name: "write-array-prepend",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration, watcherCount } = ctx;
      const cacheConfig = {
        ...configuration,
        typePolicies: {
          Project: {
            fields: {
              tasks: {
                merge(existing = [], incoming = []) {
                  return [...incoming, ...existing];
                },
              },
            },
          },
        },
      };
      const cache = new CacheFactory(cacheConfig);

      const { data: complexData, query: complexQuery } =
        operations["complex-nested"];
      const { data: addData, query: addQuery } = operations["add-task"];
      addWatchers(watcherCount, cache, complexQuery);
      cache.writeQuery({
        query: complexQuery,
        data: complexData["complex-nested"],
      });

      return {
        run() {
          return cache.writeQuery({
            query: addQuery,
            data: addData["add-task"],
          });
        },
      };
    },
  },
  {
    name: "write-array-append",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration, watcherCount } = ctx;
      const cacheConfig = {
        ...configuration,
        typePolicies: {
          Project: {
            fields: {
              tasks: {
                merge(existing = [], incoming = []) {
                  return [...existing, ...incoming];
                },
              },
            },
          },
        },
      };
      const cache = new CacheFactory(cacheConfig);

      const { data: complexData, query: complexQuery } =
        operations["complex-nested"];
      const { data: addData, query: addQuery } = operations["add-task"];
      addWatchers(watcherCount, cache, complexQuery);
      cache.writeQuery({
        query: complexQuery,
        data: complexData["complex-nested"],
      });

      return {
        run() {
          return cache.writeQuery({
            query: addQuery,
            data: addData["add-task"],
          });
        },
      };
    },
  },
  {
    name: "write-array-middle",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration, watcherCount } = ctx;
      const cacheConfig = {
        ...configuration,
        typePolicies: {
          Project: {
            fields: {
              tasks: {
                merge(existing = [], incoming = []) {
                  if (existing.length === 0) return incoming;
                  const middle = Math.floor(existing.length / 2);
                  return [
                    ...existing.slice(0, middle),
                    ...incoming,
                    ...existing.slice(middle),
                  ];
                },
              },
            },
          },
        },
      };
      const cache = new CacheFactory(cacheConfig);

      const { data: complexData, query: complexQuery } =
        operations["complex-nested"];
      const { data: addData, query: addQuery } = operations["add-task"];
      addWatchers(watcherCount, cache, complexQuery);
      cache.writeQuery({
        query: complexQuery,
        data: complexData["complex-nested"],
      });

      return {
        run() {
          return cache.writeQuery({
            query: addQuery,
            data: addData["add-task"],
          });
        },
      };
    },
  },
  {
    name: "modify-affecting-0-objects",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration, watcherCount } = ctx;
      const cache = new CacheFactory(configuration);

      const { data, query } = operations["complex-nested"];
      addWatchers(watcherCount, cache, query);
      cache.writeQuery({ query, data: data["complex-nested"] });

      return {
        run() {
          return cache.modify({
            id: cache.identify({ __typename: "Task", id: "non_existent_task" }),
            fields: {
              completed: () => true,
            },
          });
        },
      };
    },
  },
  {
    name: "modify-affecting-1-object",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration, watcherCount } = ctx;
      const cache = new CacheFactory(configuration);

      const { data, query } = operations["complex-nested"];
      addWatchers(watcherCount, cache, query);
      cache.writeQuery({ query, data: data["complex-nested"] });

      return {
        run() {
          return cache.modify({
            id: cache.identify({ __typename: "Task", id: "task_nav_redesign" }),
            fields: {
              completed: (existing) => !existing,
            },
          });
        },
      };
    },
  },
  {
    name: "write-optimistic-no-changes",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration, watcherCount } = ctx;
      const cache = new CacheFactory(configuration);

      const { data, query } = operations["complex-nested"];
      addWatchers(watcherCount, cache, query);
      cache.writeQuery({ query, data: data["complex-nested"] });

      return {
        run() {
          cache.recordOptimisticTransaction(() => {
            cache.writeQuery({
              query,
              data: data["complex-nested"],
            });
          }, "test");
        },
      };
    },
  },
  {
    name: "write-optimistic-one-field-change",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration, watcherCount } = ctx;
      const cache = new CacheFactory(configuration);

      const { data, query } = operations["complex-nested"];
      addWatchers(watcherCount, cache, query);
      cache.writeQuery({ query, data: data["complex-nested"] });

      return {
        run() {
          cache.recordOptimisticTransaction(() => {
            cache.writeQuery({
              query,
              data: data["complex-nested-single-field-change"],
            });
          }, "test");
        },
      };
    },
  },
  {
    name: "write-optimistic-changes-in-all-objects",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration, watcherCount } = ctx;
      const cache = new CacheFactory(configuration);

      const { data, query } = operations["complex-nested"];
      addWatchers(watcherCount, cache, query);
      cache.writeQuery({ query, data: data["complex-nested"] });

      return {
        run() {
          cache.recordOptimisticTransaction(() => {
            cache.writeQuery({
              query,
              data: data["complex-nested-changes-in-all-objects"],
            });
          }, "test");
        },
      };
    },
  },
  {
    name: "read-list-from-preloader",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration } = ctx;
      const cache = new CacheFactory(configuration);
      const preloader = operations["post-preloader"];
      const list = operations["comments-list"];
      const variables = { postId: "post_1", first: 40, after: null };

      cache.writeQuery({
        query: preloader.query,
        data: preloader.data["post-preloader"],
        variables,
      });

      return {
        run() {
          return cache.readQuery({ query: list.query, variables });
        },
      };
    },
  },
  {
    name: "read-header-from-preloader",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration } = ctx;
      const cache = new CacheFactory(configuration);
      const preloader = operations["post-preloader"];
      const header = operations["post-header"];
      const writeVars = { postId: "post_1", first: 40, after: null };
      const readVars = { postId: "post_1" };

      cache.writeQuery({
        query: preloader.query,
        data: preloader.data["post-preloader"],
        variables: writeVars,
      });

      return {
        run() {
          return cache.readQuery({ query: header.query, variables: readVars });
        },
      };
    },
  },
  {
    name: "read-preloader-from-parts",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration } = ctx;
      const cache = new CacheFactory(configuration);
      const preloader = operations["post-preloader"];
      const list = operations["comments-list"];
      const header = operations["post-header"];
      const listVars = { postId: "post_1", first: 40, after: null };
      const headerVars = { postId: "post_1" };

      cache.writeQuery({
        query: list.query,
        data: list.data["comments-list"],
        variables: listVars,
      });
      cache.writeQuery({
        query: header.query,
        data: header.data["post-header"],
        variables: headerVars,
      });

      return {
        run() {
          return cache.readQuery({
            query: preloader.query,
            variables: listVars,
          });
        },
      };
    },
  },
  {
    name: "write-many-ops-one-field-change",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration, watcherCount } = ctx;
      const cache = new CacheFactory(configuration);

      // Populate the cache with many unrelated operations (simulating real app)
      for (const { query, data } of extraOperations) {
        cache.writeQuery({ query, data });
      }

      // Write the main query, add watchers, then measure a write with a change.
      // Each watcher's diff triggers readOperation → applyTransformations →
      // createChunkMatcher → getCoveringOperationIds which scans all trees.
      const { data, query } = operations["complex-nested"];
      cache.writeQuery({ query, data: data["complex-nested"] });
      addWatchers(watcherCount, cache, query);

      return {
        run() {
          return cache.writeQuery({
            query,
            data: data["complex-nested-single-field-change"],
          });
        },
      };
    },
  },
  {
    // All queries are watched while their requests are in flight (as Apollo QueryInfo does).
    // Measures a single response arriving for a node shared with other pending partial watches.
    name: "write-into-pending-partial-watches",
    prepare: (ctx: ScenarioContext) => {
      const { CacheFactory, configuration, watcherCount } = ctx;
      const cache = new CacheFactory(configuration);

      for (let m = 0; m < PENDING_SIZE; m++) {
        for (const query of pendingHookQueries) {
          const watch = {
            query,
            variables: { id: String(m) },
            optimistic: true,
            returnPartialData: true,
            callback: () => {},
          };
          cache.watch(watch);
          cache.diff(watch);
        }
      }
      const half = PENDING_SIZE / 2;
      // Extra watchers of a hook that is still pending after `run()`
      addWatchers(watcherCount, cache, pendingHookQueries[PENDING_SIZE - 1], {
        id: "0",
      });
      for (let h = 0; h < half; h++) {
        cache.writeQuery({
          query: pendingHookQueries[h],
          variables: { id: "0" },
          data: pendingHookResult(0, h),
        });
      }

      return {
        run() {
          return cache.writeQuery({
            query: pendingHookQueries[half],
            variables: { id: "0" },
            data: pendingHookResult(0, half),
          });
        },
      };
    },
  },
  {
    // Initial result of a 60-item list with a deferred fragment per item, then all items in one subsequent result
    name: "defer-list-batched",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration, watcherCount } = ctx;
      const cache = new CacheFactory(configuration);

      const { data, query } = operations["defer-list"];
      const variables = { feedId: "feed_1" };
      addWatchers(watcherCount, cache, query, variables);
      const run = prepareIncrementalWrites(
        cache,
        query,
        variables,
        data["defer-list-initial"],
        toSubsequentResults(data["defer-list-incremental"], 1),
      );

      return { run };
    },
  },
  {
    // Same as defer-list-batched, but items are delivered in 6 subsequent results of 10 items,
    // while the query is watched (as Apollo QueryInfo does): per-result write + broadcast cost
    name: "defer-list-streamed",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration, watcherCount } = ctx;
      const cache = new CacheFactory(configuration);

      const { data, query } = operations["defer-list"];
      const variables = { feedId: "feed_1" };
      addWatchers(watcherCount + 1, cache, query, variables);
      const run = prepareIncrementalWrites(
        cache,
        query,
        variables,
        data["defer-list-initial"],
        toSubsequentResults(data["defer-list-incremental"], 6),
      );

      return { run };
    },
  },
  {
    // A single deferred fragment on a small object, delivered in one subsequent result (fixed cost of an incremental write)
    name: "defer-header",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration, watcherCount } = ctx;
      const cache = new CacheFactory(configuration);

      const { data, query } = operations["defer-header"];
      const variables = { postId: "post_1" };
      addWatchers(watcherCount, cache, query, variables);
      const run = prepareIncrementalWrites(
        cache,
        query,
        variables,
        data["defer-header-initial"],
        toSubsequentResults(data["defer-header-incremental"], 1),
      );

      return { run };
    },
  },
] as const satisfies Scenario[];
