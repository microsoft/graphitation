import type { Scenario, ScenarioContext } from "./types";

// This benchmark exists solely to evaluate the `cleanupNonCacheableOperations`
// feature introduced in PR #705: https://github.com/microsoft/graphitation/pull/705
//
// It models the performance-sensitive scenario from that PR: repeated writes of
// a mutation that is *not* marked with `@cache`, each using distinct variable
// values. Without cleanup, ForestRun accumulates one operation descriptor per
// distinct set of variables, since none of them share a cached data tree. With
// cleanup enabled, those descriptors are released right after the write since
// they can never be read again.
//
// `cleanupNonCacheableOperations: false` / `true` are the only two cache
// configurations declared in `config.ts` for this benchmark, so this single
// scenario run under both configurations is directly comparable and isolates
// the overhead (or savings) introduced by the flag.
const MUTATION_COUNT = 200;

export const scenarios = [
  {
    name: "write-non-cacheable-mutation-distinct-variables",
    prepare: (ctx: ScenarioContext) => {
      const { operations, CacheFactory, configuration } = ctx;
      const cache = new CacheFactory(configuration);

      // Reuse a single pre-parsed document; only variables/results change per
      // iteration, so parsing overhead never enters the measured workload.
      const { query } = operations["send-message"];

      return {
        run() {
          for (let i = 0; i < MUTATION_COUNT; i++) {
            const id = String(i);
            const text = `text-${i}`;
            cache.write({
              query,
              variables: { id, text },
              result: {
                sendMessage: { __typename: "Message", id, text },
              },
            });
          }
        },
      };
    },
  },
] as const satisfies Scenario[];
