import { ScenarioDefinition, ScenarioContext, OperationType } from "./types";

export interface MakeScenarioOptions {
  operation: OperationType;
  observerCount: number;
  prepareOverride?: (ctx: ScenarioContext) => {
    run(): void;
    cleanup?(): void;
  };
}

const defaultPrepare = (ctx: ScenarioContext) => {
  const { cache, query, variables, data } = ctx;
  const unsubscribes: Array<() => void> = [];
  if (ctx.operation === "read" || ctx.operation === "update") {
    cache.writeQuery({ query, variables, data });
  }
  for (let i = 0; i < ctx.observerCount; i++) {
    const unsub = cache.watch({
      query,
      variables,
      optimistic: true,
      callback: () => {},
    });
    unsubscribes.push(unsub);
  }
  return {
    run() {
      switch (ctx.operation) {
        case "read":
          cache.readQuery({ query, variables });
          break;
        case "write":
          cache.writeQuery({ query, variables, data });
          break;
        case "update":
          cache.writeQuery({ query, variables, data });
          break;
      }
    },
    cleanup() {
      unsubscribes.forEach((u) => u());
    },
  };
};

export function makeScenario(
  operation: OperationType,
  observerCount: number,
  prepare = defaultPrepare,
): ScenarioDefinition {
  return {
    id: `${operation}_${observerCount}`,
    label: `${operation} with ${observerCount} observers`,
    operation,
    observerCount,
    prepare,
  };
}
