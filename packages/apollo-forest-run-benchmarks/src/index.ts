import { benchmarkOperation } from "./scenario-runner";
import { checkResultsReliability } from "./reliability";
import { log, printResult } from "./logger";
import { type CacheConfig, CONFIG, OPERATIONS } from "./config";
import { BenchmarkReport, CacheConfigResults } from "./types";
import { scenarios } from "./scenarios";

function runSingleBenchmarkSuite(cacheConfig: CacheConfig): BenchmarkReport {
  const results: Array<{
    operationName: string;
    scenario: string;
    result: number[];
  }> = [];

  for (const operation of OPERATIONS) {
    for (const scenario of scenarios) {
      const observerCounts =
        "observerCounts" in scenario
          ? scenario.observerCounts
          : CONFIG.observerCounts;

      for (const observerCount of observerCounts) {
        const result = benchmarkOperation(
          operation,
          scenario,
          observerCount,
          cacheConfig,
        );
        results.push({
          operationName: operation.name,
          scenario: `${scenario.name}_${observerCount}`,
          result,
        });
      }
    }
  }

  const queryResults = OPERATIONS.map((op) => {
    const operations: Record<string, number[]> = {};
    results
      .filter((r) => r.operationName === op.name)
      .forEach((r) => {
        operations[r.scenario] = r.result;
      });
    return { queryName: op.name, operations };
  });
  return {
    config: CONFIG,
    cacheConfigResults: [{ configuration: cacheConfig, queryResults }],
  };
}

function runAllCacheConfigSuites(): BenchmarkReport {
  const cacheConfigResults: CacheConfigResults[] = [];
  for (const cfg of CONFIG.cacheConfigurations) {
    const rep = runSingleBenchmarkSuite(cfg);
    cacheConfigResults.push(...rep.cacheConfigResults);
  }
  return { config: CONFIG, cacheConfigResults };
}

function runBenchmarks(): void {
  const { maxAttempts } = CONFIG.reliability;
  let result: BenchmarkReport | undefined = undefined;
  log.start();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log.attempt(attempt);
    const currentResult = runAllCacheConfigSuites();

    const { isStable, result: mergedResult } = checkResultsReliability(
      currentResult,
      result,
    );

    result = mergedResult;

    if (isStable && attempt > CONFIG.reliability.minAttempts) {
      log.aggregated(
        result.cacheConfigResults.length,
        currentResult.cacheConfigResults.length,
      );
      console.log(`Stability achieved`);
      break;
    } else {
      console.log(`Instability detected`);
    }
  }

  printResult(result);
}

runBenchmarks();
