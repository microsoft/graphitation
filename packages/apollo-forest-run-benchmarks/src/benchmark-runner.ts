import type {
  ForestRun,
  ForestRunAdditionalConfig,
} from "@graphitation/apollo-forest-run";
import type { Scenario, OperationData, RunStats } from "./types";

import { CONFIG } from "./config";

export function benchmarkOperation(
  operation: OperationData,
  scenario: Scenario,
  observerCount: number,
  cacheFactory: typeof ForestRun,
  configuration: ForestRunAdditionalConfig,
): RunStats {
  const task = () => {
    const prepared = scenario.prepare({
      observerCount,
      cacheFactory,
      configuration,
      ...operation,
    });
    const start = process.hrtime.bigint();
    prepared.run();
    const end = process.hrtime.bigint();
    return Number(end - start) / 1000000; // ms
  };

  const samples: number[] = [];
  for (let i = 0; i < CONFIG.warmupSamples; i++) {
    task();
  }

  const iterationStart = performance.now();
  while (
    performance.now() - iterationStart < CONFIG.minExecutionTime ||
    samples.length < CONFIG.minSamples
  ) {
    for (let i = 0; i < CONFIG.batchSize; i++) {
      samples.push(task());
    }
  }

  return {
    samples,
    executionTime: performance.now() - iterationStart,
  };
}
