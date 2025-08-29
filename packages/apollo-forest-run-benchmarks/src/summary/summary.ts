import type {
  BenchStats,
  SuiteRawResult,
  BenchBase,
  Bench,
  BenchId,
  SuiteResult,
} from "../types";

import { BaseStats, ExecutionStats } from "../utils/stats";
import { CONFIG } from "../config";
import { mergeSuites } from "../utils/merge";

export interface SummaryReport {
  [scenarioName: BenchId]: BenchStats[];
}

export interface SignificantChange {
  benchId: BenchId;
  baseline: BenchStats;
  current: BenchStats;
}

const THRESHOLD = CONFIG.significantChanges.threshold;

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
      const memory = new BaseStats(memorySamples);

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
  const changes: {
    sameConfig: SignificantChange[];
    baseline: SignificantChange[];
  } = {
    sameConfig: [],
    baseline: [],
  };

  for (const [benchId, scenarioResults] of Object.entries(summary) as [
    keyof SummaryReport,
    SummaryReport[keyof SummaryReport],
  ][]) {
    // Find the baseline result (baseline factory + Default cache config)
    const defaultBaseline = scenarioResults.find(
      (result) =>
        result.cacheFactory === "baseline" && result.cacheConfig === "Default",
    )!;

    // Compare all other results against the baseline
    for (const result of scenarioResults) {
      // Skip comparing baseline with itself
      if (
        result.cacheFactory === "baseline" &&
        result.cacheConfig === "Default"
      ) {
        continue;
      }

      const configBaseline = scenarioResults.find(
        (bench) =>
          bench.cacheFactory === "baseline" &&
          bench.cacheConfig === result.cacheConfig,
      );

      // For same config comparisons: compare non-baseline factories against baseline factory with same config
      if (configBaseline && result.cacheFactory !== "baseline") {
        const hasConfigChange = isChange(configBaseline, result);
        if (hasConfigChange) {
          changes.sameConfig.push({
            benchId,
            baseline: configBaseline,
            current: result,
          });
        }
      }

      // For baseline comparisons: compare non-default configurations against default baseline
      // This shows the performance impact of choosing a specific cache configuration
      if (result.cacheConfig !== "Default") {
        const hasDefaultChange = isChange(defaultBaseline, result);
        if (hasDefaultChange) {
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
