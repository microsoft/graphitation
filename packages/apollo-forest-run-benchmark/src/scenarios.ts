import type { ForestRun } from "@graphitation/apollo-forest-run";
import type { Scenario, ScenarioContext } from "./types";
import { parse } from "graphql";

const bdQuery = parse(`query BgQuery($id: ID!) { node(id: $ID) { id value } }`);
const userQuery = parse(
  `query User($id: ID!) { user(id: $ID) { id name status } }`,
);

// Those are operations that just inflates cache size, which may affect some scenarios
// that need to loop through all operations to find some node.
const backgroundQueries = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    query: bdQuery,
    variables: { id: `${i}` },
    data: { node: { __typename: `Node${i}`, id: `${i}`, value: i } },
  }));

// User queries, useful to read many unique queries
const userQueries = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    query: userQuery,
    variables: { id: `user_${i}` },
    data: {
      user: {
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
      for (const { query, data, variables } of backgroundQueries(50)) {
        cache.writeQuery({ query, data, variables });
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
    name: "cache-misses-with-background",
    prepare: (ctx: ScenarioContext) => {
      const { CacheFactory, configuration } = ctx;
      const cache = new CacheFactory(configuration);

      // Populate the cache with many unrelated operations (simulating real app)
      for (const { query, data, variables } of backgroundQueries(50)) {
        cache.writeQuery({ query, data, variables });
      }

      const users = userQueries(5);

      return {
        run() {
          for (const { query, variables } of users) {
            cache.readQuery({ query, variables });
          }
        },
      };
    },
  },
] as const satisfies Scenario[];
