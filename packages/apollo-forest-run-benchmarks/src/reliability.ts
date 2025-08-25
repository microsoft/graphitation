import type { BenchmarkStats } from "./types";
import type { BenchmarkResult, Result, ResultIdentifier } from "./index";

import { Stats } from "./benchmark-runner";
import { CONFIG } from "./config";

export const groupResults = (results: Result[]): BenchmarkResult => {
  return results.reduce((acc, result) => {
    const key = `${result.operationName}_${result.scenario}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(result);
    return acc;
  }, {} as BenchmarkResult);
};

export const mergeBenchmarks = (
  benchmarkRuns: BenchmarkResult[],
): BenchmarkResult => {
  if (benchmarkRuns.length === 1) {
    return benchmarkRuns[0];
  }

  const merged: BenchmarkResult = {};

  for (const scenarioName of Object.keys(benchmarkRuns[0])) {
    merged[scenarioName] = [];
    for (const result of benchmarkRuns[0][scenarioName]) {
      const mergedResult: Result = {
        cacheConfig: result.cacheConfig,
        cacheFactory: result.cacheFactory,
        operationName: result.operationName,
        scenario: result.scenario,
        measurements: [],
        tasksPerMs: 0,
      };

      const measurements: {
        confidence: number;
        measurements: number[];
        tasksPerMs: number;
      }[] = [];

      for (const sc of benchmarkRuns) {
        const scenarioResults = sc[scenarioName];
        for (const res of scenarioResults) {
          if (
            res.cacheConfig !== mergedResult.cacheConfig ||
            res.cacheFactory !== mergedResult.cacheFactory ||
            res.operationName !== mergedResult.operationName
          ) {
            continue; // Skip mismatched results
          }
          const stats = new Stats(res.measurements);
          measurements.push({
            confidence: stats.confidence,
            measurements: stats.samples,
            tasksPerMs: res.tasksPerMs,
          });
        }
      }

      measurements.sort((a, b) => a.confidence - b.confidence).shift();
      const mergedMeasurement = measurements.map((m) => m.measurements).flat();
      mergedResult.measurements = mergedMeasurement;
      mergedResult.tasksPerMs =
        measurements.reduce((sum, m) => sum + m.tasksPerMs, 0) /
        measurements.length;
      merged[scenarioName].push(mergedResult);
    }
  }

  return merged;
};

export const isResultReliable = (
  current: BenchmarkResult,
  previousRuns: BenchmarkResult[] = [],
): boolean => {
  const allruns = [...previousRuns, current];
  const mergedBenchmarks = mergeBenchmarks(allruns);

  let isReliable = true;
  for (const suiteName of Object.keys(mergedBenchmarks)) {
    for (const currentResult of mergedBenchmarks[suiteName]) {
      const { confidence } = new Stats(currentResult.measurements);
      if (confidence < CONFIG.targetConfidencePercent) {
        isReliable = false;
        break;
      }
    }
  }

  return isReliable;
};

export type ScenarioSummary = BenchmarkStats & ResultIdentifier;
export interface SummaryReport {
  [scenarioName: string]: ScenarioSummary[];
}

export interface SignificantChange {
  scenarioName: string;
  operationName: string;
  baselineMean: number;
  currentMean: number;
  percentChange: number;
  cacheConfig: string;
  cacheFactory: string;
  isImprovement: boolean;
}

export interface ChangeReport {
  significantChanges: SignificantChange[];
  totalScenarios: number;
  changedScenarios: number;
}

export const getSummary = (results: (BenchmarkResult | BenchmarkResult)[]) => {
  const report: SummaryReport = {};

  const benchmarkResult = mergeBenchmarks(results);

  for (const [scenarioName, scenarioResults] of Object.entries(
    benchmarkResult,
  )) {
    report[scenarioName] = [];
    for (const {
      cacheConfig,
      cacheFactory,
      measurements,
      tasksPerMs,
    } of scenarioResults) {
      const { confidence, samples, arithmeticMean } = new Stats(measurements);
      report[scenarioName].push({
        cacheConfig,
        cacheFactory,
        confidence,
        samples: samples.length,
        mean: arithmeticMean,
        tasksPerMs,
      });
    }
  }

  return report;
};

export const analyzeSignificantChanges = (
  summary: SummaryReport,
): ChangeReport => {
  const significantChanges: SignificantChange[] = [];
  const threshold = CONFIG.significantChanges.threshold;

  let totalScenarios = 0;
  let changedScenarios = 0;

  for (const [scenarioName, scenarioResults] of Object.entries(summary)) {
    totalScenarios++;

    // Find the baseline result (baseline factory + Default cache config)
    const baseline = scenarioResults.find(
      (result) =>
        result.cacheFactory === "baseline" &&
        (result.cacheConfig as string) === "Default",
    );

    if (!baseline) {
      continue; // Skip if no baseline found
    }

    let hasSignificantChange = false;

    // Compare all other results against the baseline
    for (const result of scenarioResults) {
      // Skip comparing baseline with itself
      if (result === baseline) {
        continue;
      }

      const percentChange = (result.mean - baseline.mean) / baseline.mean;
      const absoluteChange = Math.abs(percentChange);

      if (absoluteChange >= threshold) {
        hasSignificantChange = true;

        // Extract operation name from scenario name
        const operationName = scenarioName.split("_")[0];

        significantChanges.push({
          scenarioName,
          operationName,
          baselineMean: baseline.mean,
          currentMean: result.mean,
          percentChange,
          cacheConfig: result.cacheConfig,
          cacheFactory: result.cacheFactory,
          isImprovement: percentChange < 0, // Lower mean time is better (improvement)
        });
      }
    }

    if (hasSignificantChange) {
      changedScenarios++;
    }
  }

  return {
    significantChanges,
    totalScenarios,
    changedScenarios,
  };
};
