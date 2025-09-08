import type {
  BenchStats,
  SuiteRawResult,
  SuiteResult,
  SummaryReport,
  SummaryChangeReport,
} from "../types";

import { Stats, ExecutionStats } from "../utils/stats";
import { CONFIG } from "../config";
import { mergeSuites } from "../utils/merge";

const THRESHOLD = CONFIG.reliability.stabilityThreshold;

export const getSummary = (results: SuiteRawResult[]) => {
  const summary: SummaryReport = {};
  const benchmarkResult = mergeSuites(...results);

  for (const [benchId, benchResults] of Object.entries(benchmarkResult) as [
    keyof SuiteResult,
    SuiteResult[keyof SuiteResult],
  ][]) {
    summary[benchId] = [];
    for (const {
      cacheConfig,
      cacheFactory,
      executionSamples,
      memorySamples,
      benchId,
    } of benchResults) {
      const execution = new ExecutionStats(executionSamples);
      const memory = new Stats(memorySamples);

      summary[benchId].push({
        cacheConfig,
        cacheFactory,
        confidence: execution.confidence,
        samples: execution.samples.length,
        mean: execution.arithmeticMean,
        tasksPerMs: execution.tasksPerMs,
        memoryStats: memory.arithmeticMean,
        //  gcStats: firstResult.gcStats,
      });
    }
  }

  return summary;
};

export const isMemoryChange = (
  baseline: BenchStats,
  current: BenchStats,
): boolean => {
  return (
    Math.abs(baseline.memoryStats - current.memoryStats) /
      baseline.memoryStats >
    THRESHOLD
  );
};

export const isExecutionChange = (
  baseline: BenchStats,
  current: BenchStats,
): boolean => {
  return Math.abs(baseline.mean - current.mean) / baseline.mean > THRESHOLD;
};

const isChange = (baseline: BenchStats, current: BenchStats): boolean => {
  return (
    isMemoryChange(baseline, current) || isExecutionChange(baseline, current)
  );
};

export const analyzeSignificantChanges = (summary: SummaryReport) => {
  const changes: SummaryChangeReport = {
    sameConfig: [],
    baseline: [],
  };

  for (const [benchId, benchResults] of Object.entries(summary) as [
    keyof SummaryReport,
    SummaryReport[keyof SummaryReport],
  ][]) {
    const defaultBaseline = benchResults.find(
      (bench) =>
        bench.cacheFactory === "baseline" && bench.cacheConfig === "Default",
    );

    for (const result of benchResults) {
      const configBaseline = benchResults.find(
        (bench) =>
          bench.cacheFactory === "baseline" &&
          bench.cacheConfig === result.cacheConfig,
      );

      // Compare against the same config and baseline factory. Detect impact of changes in the branch.
      if (configBaseline && result.cacheFactory !== "baseline") {
        const hasChange = isChange(configBaseline, result);
        if (hasChange) {
          changes.sameConfig.push({
            benchId,
            baseline: configBaseline,
            current: result,
          });
        }
      }

      // Compare against default config and baseline factory. Detect config changes (eg. enabling telemetry).
      if (
        defaultBaseline &&
        result.cacheConfig !== "Default" &&
        result.cacheFactory !== "baseline"
      ) {
        const hasChange = isChange(defaultBaseline, result);
        if (hasChange) {
          changes.baseline.push({
            benchId,
            baseline: defaultBaseline,
            current: result,
          });
        }
      }
    }
  }

  return changes;
};
