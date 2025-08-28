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

export interface ChangeReport {
  significantChanges: SignificantChange[];
  totalScenarios: number;
  changedScenarios: number;
}

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

const THRESHOLD = CONFIG.significantChanges.threshold;
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
      const configBaseline = scenarioResults.find(
        (bench) =>
          bench.cacheFactory === "baseline" &&
          bench.cacheConfig !== result.cacheConfig,
      )!;
      const hasDefaultChange = isChange(defaultBaseline, result);
      const hasConfigChange = isChange(configBaseline, result);

      if (hasDefaultChange) {
        changes.baseline.push({
          benchId,
          baseline: defaultBaseline,
          current: result,
        });
      }

      if (hasConfigChange) {
        changes.sameConfig.push({
          benchId,
          baseline: configBaseline,
          current: result,
        });
      }
    }
  }

  return changes;
};
