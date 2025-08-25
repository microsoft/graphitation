import type { Result } from "./index";

import { CONFIG } from "./config";
import { scenarios } from "./scenarios";
import { benchmarkOperation } from "./benchmark-runner";
import { OPERATIONS } from "./utils/get-operations";

function runBenchmarkForJob() {
  const { cacheFactory, cacheConfig } = JSON.parse(process.argv[2]);

  if (global.gc) {
    global.gc();
  }

  const { ForestRun } = require(cacheFactory.importPath);
  const results: Result[] = [];
  for (const operation of OPERATIONS) {
    for (const scenario of scenarios) {
      for (const observerCount of CONFIG.observerCounts) {
        const { samples, executionTime } = benchmarkOperation(
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
          executionTime,
        });
      }
    }
  }

  console.log(JSON.stringify(results));
}

runBenchmarkForJob();
