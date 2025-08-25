import type {
  ForestRun,
  ForestRunAdditionalConfig,
} from "@graphitation/apollo-forest-run";
import type { Scenario, OperationData, RunStats } from "./types";
import { do_not_optimize } from "./utils/do-not-optimize";

import { CONFIG } from "./config";

const hasEnoughSamples = (stats: number[], startedAt: number) => {
  const { minExecutionTime, minSamples } = CONFIG;
  return (
    stats.length >= minSamples &&
    performance.now() - startedAt >= minExecutionTime
  );
};

export function benchmarkOperation(
  operation: OperationData,
  scenario: Scenario,
  observerCount: number,
  cacheFactory: typeof ForestRun,
  configuration: ForestRunAdditionalConfig,
): number[] {
  const { warmupSamples, batchSize } = CONFIG;

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
    return Number(end - start); // nano
  };

  const samples: number[] = [];
  for (let i = 0; i < warmupSamples; i++) {
    do_not_optimize(task());
  }

  const iterationStart = performance.now();
  while (!hasEnoughSamples(samples, iterationStart)) {
    for (let i = 0; i < batchSize; i++) {
      samples.push(task());
    }
  }

  return samples;
}
