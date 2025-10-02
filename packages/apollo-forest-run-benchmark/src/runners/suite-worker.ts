import type { CacheConfig, BenchRaw, WorkerResult } from "../types";
import { CACHE_FACTORIES } from "../config";

import { CONFIG } from "../config";
import { scenarios } from "../scenarios";
import { benchmarkRunner } from "./benchmark-runner";
import { OPERATIONS } from "../utils/operations";
import { GarbageCollector } from "../utils/garbage-collection";

export const runBenchmark = () => {
  const {
    cacheFactory = CACHE_FACTORIES[0],
    cacheConfig = CONFIG.cacheConfigurations[0],
  }: {
    cacheFactory: (typeof CACHE_FACTORIES)[number];
    cacheConfig: CacheConfig;
  } = JSON.parse(process.argv[2] ?? "{}");

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ForestRun } = require(cacheFactory.importPath);
  const results: BenchRaw[] = [];
  const gc = new GarbageCollector();

  for (const scenario of scenarios) {
    for (const watcherCount of CONFIG.watcherCounts) {
      gc.collect();
      const runStats = benchmarkRunner(
        OPERATIONS,
        scenario,
        watcherCount,
        ForestRun,
        cacheConfig.options,
      );
      results.push({
        cacheConfig: cacheConfig.name,
        cacheFactory: cacheFactory.name,
        benchId: `${scenario.name}_${watcherCount}`,
        samples: runStats,
      });
    }
  }

  const response: WorkerResult = {
    results,
    gcStats: gc.getStats(),
  };

  console.log(JSON.stringify(response));
};

runBenchmark();
