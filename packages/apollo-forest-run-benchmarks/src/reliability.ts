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

/**
 * Merges multiple benchmark runs, excluding the least reliable ones if there are more than 2 runs.
 * For runs with more than 2 results, it excludes the one with the lowest average confidence.
 */
export const mergeBenchmarks = (
  benchmarkRuns: BenchmarkResult[],
): BenchmarkResult => {
  if (benchmarkRuns.length === 1) {
    return benchmarkRuns[0];
  }

  const merged: BenchmarkResult = {};

  for (const scenarioName of Object.keys(benchmarkRuns[0])) {
    merged[scenarioName] = [];
    for (const run of benchmarkRuns) {
      const scenarioResults = run[scenarioName];

      for (const result of scenarioResults) {
        const mergedResult: Result = {
          cacheConfig: result.cacheConfig,
          cacheFactory: result.cacheFactory,
          operationName: result.operationName,
          scenario: result.scenario,
          measurements: [],
        };

        const measurements: {
          confidence: number;
          measurements: number[];
        }[] = [];
        for (const sc of benchmarkRuns) {
          const scenarioResults = sc[scenarioName];
          for (const res of scenarioResults) {
            const stats = new Stats(res.measurements);
            measurements.push({
              confidence: stats.confidence,
              measurements: stats.samples,
            });
          }
        }

        measurements.sort((a, b) => a.confidence - b.confidence).shift();
        const mergedMeasurement = measurements
          .map((m) => m.measurements)
          .flat();
        mergedResult.measurements = mergedMeasurement;
        merged[scenarioName].push(mergedResult);
      }
    }
  }

  return merged;
};

export const checkResultsReliability = (
  current: BenchmarkResult,
  previousRuns?: BenchmarkResult[],
) => {
  if (!previousRuns || previousRuns.length === 0) {
    // First run, no previous results to compare against
    return { isStable: true };
  }

  const mergedPrevious = mergeBenchmarks(previousRuns);

  let isStable = true;
  for (const suiteName of Object.keys(current)) {
    const currentSuite = current[suiteName];
    const previousSuite = mergedPrevious[suiteName];

    if (!previousSuite) {
      isStable = false;
      continue;
    }

    // Compare current and merged previous results for this suite
    for (const currentResult of currentSuite) {
      const previousResult = previousSuite.find(
        (r) =>
          r.cacheConfig === currentResult.cacheConfig &&
          r.cacheFactory === currentResult.cacheFactory,
      );
      if (!previousResult) {
        // If there's no previous result, we can't determine stability
        isStable = false;
        continue;
      }
      // Check if the results are within the acceptable range
      const { confidence } = new Stats(currentResult.measurements);
      if (confidence < CONFIG.targetConfidencePercent) {
        isStable = false;
      }
    }
  }

  return {
    isStable,
  };
};

export interface SummaryReport {
  [scenarioName: string]: (BenchmarkStats & ResultIdentifier)[];
}

export const getSummary = (results: (BenchmarkResult | BenchmarkResult)[]) => {
  const report: SummaryReport = {};

  // Handle both single result and array of results

  const benchmarkResult = mergeBenchmarks(results);

  for (const [scenarioName, scenarioResults] of Object.entries(
    benchmarkResult,
  )) {
    report[scenarioName] = [];
    for (const { cacheConfig, cacheFactory, measurements } of scenarioResults) {
      const { confidence, samples, arithmeticMean } = new Stats(measurements);
      report[scenarioName].push({
        cacheConfig,
        cacheFactory,
        confidence,
        samples: samples.length,
        mean: arithmeticMean,
      });
    }
  }

  return report;
};
