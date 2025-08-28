import type { Result } from "./index";
import type { CACHE_FACTORIES, CacheConfig } from "./config";

import { CONFIG } from "./config";
import { scenarios } from "./scenarios";
import { benchmarkOperation } from "./benchmark-runner";
import { OPERATIONS } from "./utils/get-operations";
import { garbageCollect } from "./utils/garbage-collection";

async function runBenchmarkForJob() {
  const {
    cacheFactory,
    cacheConfig,
  }: {
    cacheFactory: (typeof CACHE_FACTORIES)[number];
    cacheConfig: CacheConfig;
  } = JSON.parse(process.argv[2]);

  const { ForestRun } = require(cacheFactory.importPath);
  const results: Result[] = [];
  for (const operation of OPERATIONS) {
    for (const scenario of scenarios) {
      for (const observerCount of CONFIG.observerCounts) {
        await garbageCollect();

        const samples = benchmarkOperation(
          operation,
          scenario,
          observerCount,
          ForestRun,
          cacheConfig.options,
        );
        results.push({
          cacheConfig: cacheConfig.name,
          cacheFactory: cacheFactory.name,
          operationName: operation.name,
          scenario: `${scenario.name}_${observerCount}`,
          samples,
        });
      }
    }
  }

  return results;
}

runBenchmarkForJob().then((results) => {
  console.log(JSON.stringify(results));
});
