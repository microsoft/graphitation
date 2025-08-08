import fs from "fs";
import path from "path";
import { SimpleWorkerPool } from "./worker-pool";
import { benchmarkOperation } from "./scenario-runner";
import { calculateAggregatedResults } from "./aggregation";
import { checkResultsReliabilityAgainstAll } from "./reliability";
import { log } from "./logger";
import { CONFIG } from "./config";
import {
  BenchmarkReport,
  CacheConfigResults,
  CacheConfiguration,
  BenchmarkSuiteResult,
} from "./types";

async function runSingleBenchmarkSuite(
  cacheConfig: CacheConfiguration,
): Promise<BenchmarkReport> {
  const queryKeys = Object.keys(CONFIG.queries);
  const tasks: Array<
    () => Promise<{
      queryKey: string;
      operation: string;
      result: BenchmarkSuiteResult;
    }>
  > = [];
  for (const q of queryKeys) {
    for (const op of ["read", "write", "update"] as const) {
      for (const observerCount of CONFIG.observerCounts) {
        tasks.push(() =>
          benchmarkOperation(q, op, observerCount, cacheConfig).then(
            (result: BenchmarkSuiteResult) => ({
              queryKey: q,
              operation: `${op}_${observerCount}`,
              result,
            }),
          ),
        );
      }
    }
  }
  const pool = new SimpleWorkerPool();
  const results = await pool.execute(tasks);
  const queryResults = queryKeys.map((q) => {
    const operations: Record<string, BenchmarkSuiteResult> = {};
    results
      .filter((r) => r.queryKey === q)
      .forEach((r) => {
        operations[r.operation] = r.result;
      });
    return { queryName: q, operations };
  });
  return {
    config: CONFIG,
    cacheConfigResults: [{ configuration: cacheConfig, queryResults }],
  };
}

async function runAllCacheConfigSuites(): Promise<BenchmarkReport> {
  const cacheConfigResults: CacheConfigResults[] = [];
  for (const cfg of CONFIG.cacheConfigurations) {
    const rep = await runSingleBenchmarkSuite(cfg);
    cacheConfigResults.push(...rep.cacheConfigResults);
  }
  return { config: CONFIG, cacheConfigResults };
}

async function runBenchmarks(): Promise<BenchmarkReport> {
  const { thresholdPercent, maxAttempts, requiredConsecutive } =
    CONFIG.reliability;
  const allRuns: BenchmarkReport[] = [];
  let consecutive = 0;
  log.start();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log.attempt(attempt);
    const current = await runAllCacheConfigSuites();
    if (attempt === 1) {
      allRuns.push(current);
      consecutive = 1;
      continue;
    }
    const isStable = checkResultsReliabilityAgainstAll(
      allRuns,
      current,
      thresholdPercent,
    );
    allRuns.push(current);
    if (isStable) {
      consecutive++;
      log.stable(consecutive, requiredConsecutive);
      if (consecutive >= requiredConsecutive) break;
    } else {
      log.variation();
      consecutive = 1; // reset stability counter
    }
  }
  const finalReport = calculateAggregatedResults(allRuns);
  log.aggregated(allRuns.length, finalReport.cacheConfigResults.length);
  const reportPath = path.join(
    __dirname,
    `benchmark-report-${Date.now()}.json`,
  );
  fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
  log.reportSaved(reportPath);
  return finalReport;
}

if (require.main === module) {
  runBenchmarks().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}

export { runBenchmarks, benchmarkOperation };
