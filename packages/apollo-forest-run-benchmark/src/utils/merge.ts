import type {
  SuiteRawResult,
  Bench,
  WorkerResult,
  BenchRaw,
  SuiteResult,
} from "../types";

import { BaseStats, ExecutionStats } from "./stats";

const getSortedBenchSamples = (
  benchData: BenchRaw,
  suites: SuiteRawResult[],
): {
  memorySamples: number[][];
  executionSamples: number[][];
} => {
  const memorySamples = [];
  const executionSamples = [];

  for (const suite of suites) {
    const suiteBenchs = suite[benchData.benchId];
    for (const bench of suiteBenchs) {
      if (
        bench.cacheConfig !== benchData.cacheConfig ||
        bench.cacheFactory !== benchData.cacheFactory ||
        bench.benchId !== benchData.benchId
      ) {
        continue;
      }
      memorySamples.push([...bench.samples.map((s) => s.memory)]);
      executionSamples.push([...bench.samples.map((s) => s.time)]);
    }
  }

  executionSamples.sort((a, b) => {
    const { tasksPerMs: ATasksPerMs } = new ExecutionStats(a);
    const { tasksPerMs: BTasksPerMs } = new ExecutionStats(b);
    return BTasksPerMs - ATasksPerMs;
  });

  memorySamples.sort((a, b) => {
    const { arithmeticMean: AMean } = new BaseStats(a);
    const { arithmeticMean: BMean } = new BaseStats(b);
    return BMean - AMean;
  });

  return { memorySamples, executionSamples };
};

const getBenchSamples = (
  benchData: BenchRaw,
  suites: SuiteRawResult[],
): Bench => {
  const { memorySamples, executionSamples } = getSortedBenchSamples(
    benchData,
    suites,
  );

  if (suites.length > 5) {
    executionSamples.shift();
    executionSamples.pop();
    memorySamples.shift();
    memorySamples.pop();
  }

  return {
    benchId: benchData.benchId,
    cacheConfig: benchData.cacheConfig,
    cacheFactory: benchData.cacheFactory,
    memorySamples: memorySamples.flat(),
    executionSamples: executionSamples.flat(),
  };
};

export const mergeResults = (results: WorkerResult[]): SuiteRawResult => {
  const flatResults = results.map((r) => r.results).flat();
  const merged: SuiteRawResult = {};

  for (const result of flatResults) {
    const key = result.benchId;
    if (!merged[key]) {
      merged[key] = [];
    }
    merged[key].push(result);
  }

  return merged;
};

export const mergeSuites = (
  ...benchmarkRuns: SuiteRawResult[]
): SuiteResult => {
  const merged: SuiteResult = {};

  const benchIds = Object.keys(benchmarkRuns[0]) as (keyof SuiteResult)[];

  for (const benchId of benchIds) {
    merged[benchId] = [];
    for (const result of benchmarkRuns[0][benchId]) {
      const samples = getBenchSamples(result, benchmarkRuns);

      merged[benchId].push(samples);
    }
  }

  return merged;
};
