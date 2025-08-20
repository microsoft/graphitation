import type { CacheConfig } from "./config";

import { isResultReliable, groupResults, getSummary } from "./reliability";
import { log } from "./logger";
import { analyzeResults } from "./analyze-results";
import { CONFIG, OPERATIONS } from "./config";
import { scenarios } from "./scenarios";
import type {
  ForestRunAdditionalConfig,
  ForestRun,
} from "@graphitation/apollo-forest-run";
import { benchmarkOperation } from "./benchmark-runner";

// @ts-ignore
import { ForestRun as BaselineForestRun } from "./forest-runs/baseline";
// @ts-ignore
import { ForestRun as CurrentForestRun } from "./forest-runs/current";

// Export analysis functions for external usage
export { analyzeSignificantChanges, getSummary } from "./reliability";
export { generateMarkdownReport, printSignificantChanges } from "./logger";

export interface ResultIdentifier {
  cacheConfig: CacheConfig["name"];
  cacheFactory: ReturnType<typeof getCacheFactories>[number]["name"];
}

export interface Result extends ResultIdentifier {
  scenario: `${(typeof scenarios)[number]["name"]}_${number}`;
  measurements: number[];
  operationName: string;
}

const getCacheFactories = (config: ForestRunAdditionalConfig = {}) => {
  return [
    {
      name: "baseline",
      factory: () => new BaselineForestRun(config as any),
    },
    {
      name: "current",
      factory: () => new CurrentForestRun(config),
    },
  ] as unknown as {
    name: "baseline" | "current";
    factory: (config?: ForestRunAdditionalConfig) => ForestRun;
  }[];
};

function runBenchmarkSuite() {
  const results: Result[] = [];

  for (const cfg of CONFIG.cacheConfigurations) {
    for (const operation of OPERATIONS) {
      for (const scenario of scenarios) {
        for (const observerCount of CONFIG.observerCounts) {
          for (const cacheFactory of getCacheFactories(cfg.options)) {
            const measurements = benchmarkOperation(
              operation,
              scenario,
              observerCount,
              cacheFactory.factory,
            );
            results.push({
              cacheConfig: cfg.name,
              cacheFactory: cacheFactory.name,
              operationName: operation.name,
              scenario: `${scenario.name}_${observerCount}`,
              measurements,
            });
          }
        }
      }
    }
  }

  return results;
}

export interface BenchmarkResult {
  [scenarioName: string]: Result[];
}

function runBenchmarks(): void {
  const { maxAttempts } = CONFIG.reliability;
  let prevBenchmarks: BenchmarkResult[] = [];
  log.start();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log.attempt(attempt);
    const currentResult = runBenchmarkSuite();

    const groupedResults = groupResults(currentResult);

    const isReliable = isResultReliable(groupedResults, prevBenchmarks);

    prevBenchmarks.push(groupedResults);

    if (isReliable && attempt > CONFIG.reliability.minAttempts) {
      break;
    }
  }

  const summary = getSummary(prevBenchmarks);
  analyzeResults(summary);
}

runBenchmarks();
