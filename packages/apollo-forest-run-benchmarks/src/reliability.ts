import type { BenchmarkStats } from "./types";
import type { BenchmarkResult, Result, ResultIdentifier } from "./index";

import { Stats } from "./utils/stats";
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

// add this helper above mergeBenchmarks
const getReliableMeasurementsForScenario = (
  scenarioName: string,
  templateResult: Result,
  benchmarkRuns: BenchmarkResult[],
): { samples: number[] } => {
  const measurements: { samples: number[] }[] = [];

  for (const sc of benchmarkRuns) {
    const scenarioResults = sc[scenarioName] ?? [];
    for (const res of scenarioResults) {
      if (
        res.cacheConfig !== templateResult.cacheConfig ||
        res.cacheFactory !== templateResult.cacheFactory ||
        res.operationName !== templateResult.operationName
      ) {
        continue;
      }
      const { samples } = new Stats(res.samples);
      measurements.push({
        samples,
      });
    }
  }

  if (measurements.length === 0) {
    return { samples: [] };
  }

  measurements.sort((a, b) => {
    const { tasksPerMs: ATasksPerMs } = new Stats(a.samples);
    const { tasksPerMs: BTasksPerMs } = new Stats(b.samples);
    return BTasksPerMs - ATasksPerMs;
  });
  measurements.shift();

  const mergedMeasurement = measurements.map((m) => m.samples).flat();

  return { samples: mergedMeasurement };
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
      const { samples } = getReliableMeasurementsForScenario(
        scenarioName,
        result,
        benchmarkRuns,
      );
      const mergedResult: Result = {
        ...result,
        samples,
      };

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
      const { confidence } = new Stats(currentResult.samples);
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
    for (const { cacheConfig, cacheFactory, samples } of scenarioResults) {
      const {
        confidence,
        samples: sampleCount,
        arithmeticMean,
        tasksPerMs,
      } = new Stats(samples);
      report[scenarioName].push({
        cacheConfig,
        cacheFactory,
        confidence,
        samples: sampleCount.length,
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
