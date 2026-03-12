import type { ForestRun } from "@graphitation/apollo-forest-run";
import type { Scenario, ScenarioContext } from "./types";

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
] as const satisfies Scenario[];
