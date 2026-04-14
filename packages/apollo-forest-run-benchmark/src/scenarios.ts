import type { ForestRun } from "@graphitation/apollo-forest-run";
import type { Scenario, ScenarioContext } from "./types";
import { parse } from "graphql";

// Pre-parse 50 unique named queries to simulate a real app with many active operations.
// Each has its own operation name and data, creating separate trees in the forest.
// This is the setup that exposes O(n) scans in getCoveringOperationIds.
const EXTRA_OPS_COUNT = 50;
const extraOperations = Array.from({ length: EXTRA_OPS_COUNT }, (_, i) => ({
  query: parse(`query BgQuery${i} { node${i}(id: "${i}") { id value } }`),
  data: { [`node${i}`]: { __typename: `Node${i}`, id: `${i}`, value: i } },
}));

// Pre-parse 500 unique queries for read-scaling benchmarks.
// Simulates a long-running app where many operations accumulate in the cache
// (e.g., 25 roster open/close cycles adding ~40 operations each).
// All queries share ROOT_QUERY, so reading any new query forces iteration
// of all accumulated operations' ROOT_QUERY chunks via getNodeChunks.
const READ_SCALING_OPS_COUNT = 500;
const readScalingOperations = Array.from(
  { length: READ_SCALING_OPS_COUNT },
  (_, i) => ({
    query: parse(
      `query CachedOp${i} { entity${i}(id: "${i}") { id name status } }`,
    ),
    data: {
      [`entity${i}`]: {
        __typename: `Entity`,
        id: `entity_${i}`,
        name: `Entity ${i}`,
        status: "active",
      },
    },
  }),
);

// Simulates a burst of cold reads like a roster panel opening:
// each read uses a unique query (different user ID), creating a new tree.
// This compounds: read N iterates (BASE_OPS + N) ROOT_QUERY chunks.
const BURST_READ_COUNT = 50;
const burstReadQueries = Array.from({ length: BURST_READ_COUNT }, (_, i) => ({
  query: parse(
    `query UserRead${i} { user${i}(id: "${i}") { id name status } }`,
  ),
  data: {
    [`user${i}`]: {
      __typename: "User",
      id: `user_${i}`,
      name: `User ${i}`,
      status: "available",
    },
  },
}));

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
    name: "read-cold-burst-from-large-cache",
    prepare: (ctx: ScenarioContext) => {
      const { CacheFactory, configuration } = ctx;
      const cache = new CacheFactory(configuration);

      // Populate cache with 500 operations — simulates a long-running app
      // where roster open/close cycles accumulate trees without eviction.
      // All operations share ROOT_QUERY as a node.
      for (const { query, data } of readScalingOperations) {
        cache.writeQuery({ query, data });
      }

      // Write user data so nodes exist in the cache
      for (const { query, data } of burstReadQueries) {
        cache.writeQuery({ query, data });
      }

      return {
        run() {
          // Simulate a roster panel opening: 50 cold reads in sequence.
          // Each read uses a fresh DocumentNode → new operation descriptor →
          // resultsMap miss → growOutputTree → getNodeChunks("ROOT_QUERY").
          //
          // Critically, each cold read adds a new tree to the forest via
          // growDataTree → addTree. So read N iterates (500 + N) ROOT_QUERY
          // chunks — the cost compounds within the burst.
          // Total: SUM(500..549) ≈ 26,250 ROOT_QUERY chunk iterations.
          for (const { query } of burstReadQueries) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const freshQuery = parse(query.loc!.source.body);
            cache.readQuery({ query: freshQuery });
          }
        },
      };
    },
  },
] as const satisfies Scenario[];
