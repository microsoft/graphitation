import type { CacheConfig, WorkerResult, SuiteRawResult } from "./types";

import path from "path";
import { CACHE_FACTORIES } from "./config";
import { log } from "./utils/logger";
import { analyzeResults } from "./summary/analyze-results";
import { CONFIG } from "./config";
import { spawn } from "child_process";
import { mergeResults } from "./utils/merge";
import { getSummary } from "./summary/summary";

interface BaseSuite {
  cacheFactory: (typeof CACHE_FACTORIES)[number];
  cacheConfig: CacheConfig;
}

const BASE_SUITES: BaseSuite[] = [];

for (const cacheFactory of CACHE_FACTORIES) {
  for (const cacheConfig of CONFIG.cacheConfigurations) {
    BASE_SUITES.push({ cacheFactory, cacheConfig });
  }
}

const spawnProcess = (job: BaseSuite): Promise<WorkerResult> => {
  return new Promise((resolve) => {
    const workerScript = path.join(__dirname, "runners", "suite-worker.js");
    const child = spawn(
      process.execPath,
      [
        "--noconcurrent_sweeping",
        "--noconcurrent_recompilation",
        workerScript,
        JSON.stringify(job),
      ],
      {
        env: {
          ...process.env,
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    let stdout = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      console.error(data.toString());
    });

    child.on("close", () => {
      const results = JSON.parse(stdout.trim());
      resolve(results);
    });
  });
};

const runBaseSuites = async (): Promise<WorkerResult[]> => {
  const allResults: WorkerResult[] = [];

  for (const suite of BASE_SUITES) {
    console.log(
      `\n=== Running benchmarks for ${suite.cacheFactory.name} with ${suite.cacheConfig.name} in isolated process ===`,
    );

    const result = await spawnProcess(suite);
    allResults.push(result);
    console.log(
      `Completed ${suite.cacheFactory.name}/${suite.cacheConfig.name} with ${result.results.length} results`,
    );
  }

  return allResults;
};

const runBenchmarks = async (): Promise<void> => {
  const { epochs } = CONFIG.reliability;
  const prevSuites: SuiteRawResult[] = [];
  log.start();
  for (let attempt = 1; attempt <= epochs; attempt++) {
    log.attempt(attempt);

    const results = await runBaseSuites();
    const groupedResult = mergeResults(results);

    prevSuites.push(groupedResult);
  }

  const summary = getSummary(prevSuites);
  analyzeResults(summary);
};

runBenchmarks();
