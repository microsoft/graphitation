import type { ForestRun } from "@graphitation/apollo-forest-run";
import type { Scenario, ScenarioContext } from "./types";
const addWatchers = (ctx: ScenarioContext, cache: ForestRun) => {
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
      const { query, variables, data, cacheFactory, configuration } = ctx;
      const cache = new cacheFactory(configuration);
      addWatchers(ctx, cache);

      cache.writeQuery({ query, variables, data });

      return {
        run() {
          return cache.readQuery({ query, variables });
        },
      };
    },
  },
  {
    name: "write",
    prepare: (ctx: ScenarioContext) => {
      const { query, variables, data, cacheFactory, configuration } = ctx;
      const cache = new cacheFactory(configuration);
      addWatchers(ctx, cache);

      return {
        run() {
          return cache.writeQuery({ query, variables, data });
        },
      };
    },
  },
  {
    name: "update",
    prepare: (ctx: ScenarioContext) => {
      const { query, variables, data, cacheFactory, configuration } = ctx;
      const cache = new cacheFactory(configuration);
      addWatchers(ctx, cache);

      cache.writeQuery({ query, variables, data });

      return {
        run() {
          return cache.writeQuery({ query, variables, data });
        },
      };
    },
  },
] as const satisfies Scenario[];
