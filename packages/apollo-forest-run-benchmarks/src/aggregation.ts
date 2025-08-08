import {
  BenchmarkReport,
  BenchmarkSuiteResult,
  CacheConfigResults,
  CacheConfiguration,
  BenchmarkResultPoint,
} from "./types";
import { Stats } from "./benchmark-runner";

function aggregateOperationSuites(
  suites: BenchmarkSuiteResult[],
): BenchmarkSuiteResult {
  if (!suites.length) throw new Error("No suites to aggregate");
  if (suites.length === 1) return suites[0];
  const first = suites[0];
  const aggregatedResults: BenchmarkResultPoint[] = first.results.map(
    (_, idx) => {
      const points = suites.map((s) => s.results[idx]);
      const allSamples = points.flatMap((p) => p.rawSamples);
      if (!allSamples.length) throw new Error("No samples in points");

      // Use Stats class for consistent outlier filtering and calculations
      const stats = new Stats(allSamples);
      const mean = stats.arithmeticMean();
      const rme = stats.relativeMarginOfError();
      const confidence = 100 - rme;

      return {
        name: points[0].name,
        mean,
        rme,
        samples: stats.effectiveSampleCount(),
        confidence,
        rawSamples: [],
      };
    },
  );
  return { suiteName: first.suiteName, results: aggregatedResults };
}

function collectQueryOperationSuites(
  allResults: BenchmarkReport[],
  cacheConfigName: string,
  queryName: string,
): Record<string, BenchmarkSuiteResult[]> {
  const map: Record<string, BenchmarkSuiteResult[]> = {};
  for (const run of allResults) {
    const cfg = run.cacheConfigResults.find(
      (c) => c.configuration.name === cacheConfigName,
    );
    const query = cfg?.queryResults.find((q) => q.queryName === queryName);
    if (!query) continue;
    for (const opKey of Object.keys(query.operations)) {
      const suite = query.operations[opKey];
      (map[opKey] ||= []).push(suite);
    }
  }
  return map;
}

function aggregateCacheConfig(
  allResults: BenchmarkReport[],
  cacheCfg: CacheConfiguration,
  config: BenchmarkReport["config"],
): CacheConfigResults {
  const queryResults: CacheConfigResults["queryResults"] = [];
  const queryNames = Object.keys(config.queries);
  for (const qName of queryNames) {
    const opSuitesMap = collectQueryOperationSuites(
      allResults,
      cacheCfg.name,
      qName,
    );
    const opKeys = Object.keys(opSuitesMap);
    if (!opKeys.length) continue;
    const operations: Record<string, BenchmarkSuiteResult> = {};
    for (const opKey of opKeys)
      operations[opKey] = aggregateOperationSuites(opSuitesMap[opKey]);
    queryResults.push({ queryName: qName, operations });
  }
  return { configuration: cacheCfg, queryResults };
}

export function calculateAggregatedResults(
  allResults: BenchmarkReport[],
): BenchmarkReport {
  if (allResults.length === 1) return allResults[0];
  const config = allResults[0].config;
  const cacheConfigResults = config.cacheConfigurations.map((cfg) =>
    aggregateCacheConfig(allResults, cfg, config),
  );
  return { config, cacheConfigResults };
}
