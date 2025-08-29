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

  const { ForestRun } = require(cacheFactory.importPath);
  const results: BenchRaw[] = [];
  const gc = new GarbageCollector();

  for (const operation of OPERATIONS) {
    for (const scenario of scenarios) {
      for (const observerCount of CONFIG.observerCounts) {
        gc.collect();
        const runStats = benchmarkRunner(
          operation,
          scenario,
          observerCount,
          ForestRun,
          cacheConfig.options,
        );
        results.push({
          cacheConfig: cacheConfig.name,
          cacheFactory: cacheFactory.name,
          benchId: `${operation.name}_${scenario.name}_${observerCount}`,
          samples: runStats,
        });
      }
    }
  }

  const response: WorkerResult = {
    results,
    gcStats: gc.getStats(),
  };

  console.log(JSON.stringify(response));
};

runBenchmark();
