import type { Result } from "./index";

import { CONFIG } from "./config";
import { scenarios } from "./scenarios";
import { benchmarkOperation } from "./benchmark-runner";
import { OPERATIONS } from "./utils/get-operations";

function runBenchmarkForJob() {
  const { cacheFactory, cacheConfig } = JSON.parse(process.argv[2]);
  const { ForestRun } = require(cacheFactory.importPath);
  const results: Result[] = [];
  for (const operation of OPERATIONS) {
    for (const scenario of scenarios) {
      for (const observerCount of CONFIG.observerCounts) {
        // Minor GC between scenarios
        if (global.gc) {
          global.gc();
        }

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

  console.log(JSON.stringify(results));
}

runBenchmarkForJob();
