import type { ForestRun } from "@graphitation/apollo-forest-run";
import type { Scenario, ScenarioContext } from "./types";
import { do_not_optimize } from "mitata";

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
        name: "read",
        run() {
          const result = cache.readQuery({ query, variables });
          return do_not_optimize(result);
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
        name: "write",
        run() {
          const result = cache.writeQuery({ query, variables, data });
          return do_not_optimize(result);
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
          const result = cache.writeQuery({ query, variables, data });
          return do_not_optimize(result);
        },
      };
    },
  },
] as const satisfies Scenario[];
