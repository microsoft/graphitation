import { ForestRun } from "@graphitation/apollo-forest-run";
import { Scenario, ScenarioContext } from "./types";

const addObservers = (ctx: ScenarioContext, cache: ForestRun) => {
  const { query, variables } = ctx;
  const unsubscribes: Array<() => void> = [];
  for (let i = 0; i < ctx.observerCount; i++) {
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
    name: "read",
    prepare: (ctx: ScenarioContext) => {
      const { query, variables, data, cacheConfig } = ctx;
      const cache = new ForestRun(cacheConfig.options);
      const unsubscribes = addObservers(ctx, cache);

      cache.writeQuery({ query, variables, data });

      return {
        name: "read",
        run() {
          cache.readQuery({ query, variables });
        },
      };
    },
  },
  {
    name: "write",
    prepare: (ctx: ScenarioContext) => {
      const { query, variables, data, cacheConfig } = ctx;
      const cache = new ForestRun(cacheConfig.options);
      const unsubscribes = addObservers(ctx, cache);

      return {
        name: "write",
        run() {
          cache.writeQuery({ query, variables, data });
        },
      };
    },
  },
  {
    name: "update",
    prepare: (ctx: ScenarioContext) => {
      const { query, variables, data, cacheConfig } = ctx;
      const cache = new ForestRun(cacheConfig.options);
      const unsubscribes = addObservers(ctx, cache);

      cache.writeQuery({ query, variables, data });

      return {
        run() {
          cache.writeQuery({ query, variables, data });
        },
      };
    },
  },
  {
    name: "eviction",
    observerCounts: [0], // Eviction performance doesn't depend on observers
    prepare: (ctx: ScenarioContext) => {
      const { query, variables, data, cacheConfig } = ctx;
      const cache = new ForestRun(cacheConfig.options);
      for (let i = 0; i < 10; i++) {
        cache.writeQuery({
          query,
          variables: { ...variables, id: i.toString() },
          data: { ...data, id: i + data.id },
        });
      }
      return {
        run() {
          cache.gc();
        },
      };
    },
  },
] as const satisfies Scenario[];
