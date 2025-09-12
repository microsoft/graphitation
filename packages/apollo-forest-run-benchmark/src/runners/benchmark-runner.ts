import type {
  ForestRun,
  ForestRunAdditionalConfig,
} from "@graphitation/apollo-forest-run";
import type { Scenario, OperationData, Sample } from "../types";

import { CONFIG } from "../config";

const hasEnoughSamples = (stats: unknown[], startedAt: number): boolean => {
  const { minExecutionTime, minSamples } = CONFIG.sampling;
  return (
    stats.length >= minSamples &&
    performance.now() - startedAt >= minExecutionTime
  );
};

export const benchmarkRunner = (
  operations: Record<string, OperationData>,
  scenario: Scenario,
  watcherCount: number,
  CacheFactory: typeof ForestRun,
  configuration: ForestRunAdditionalConfig,
): Sample[] => {
  const { warmupSamples, batchSize } = CONFIG.sampling;

  const task = () => {
    const prepared = scenario.prepare({
      watcherCount,
      CacheFactory,
      configuration,
      operations,
    });
    const memoryStart = process.memoryUsage().heapUsed;
    const timeStart = process.hrtime.bigint();

    prepared.run();

    const timeEnd = process.hrtime.bigint();
    const memoryEnd = process.memoryUsage().heapUsed;

    return {
      time: Number(timeEnd - timeStart), // nanoseconds
      memory: memoryEnd - memoryStart, // bytes
    };
  };

  const samples: Sample[] = [];

  // Warmup phase
  for (let i = 0; i < warmupSamples; i++) {
    task();
  }

  const iterationStart = performance.now();
  while (!hasEnoughSamples(samples, iterationStart)) {
    for (let i = 0; i < batchSize; i++) {
      samples.push(task());
    }
  }

  return samples;
};
