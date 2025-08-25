import type { CacheConfig } from "./config";
import fs from "fs";
import { isResultReliable, groupResults, getSummary } from "./reliability";
import { log } from "./logger";
import { analyzeResults } from "./analyze-results";
import { CONFIG } from "./config";
import { scenarios } from "./scenarios";
import { spawn } from "child_process";
import path from "path";

// Export analysis functions for external usage
export { analyzeSignificantChanges, getSummary } from "./reliability";
export { generateMarkdownReport, printSignificantChanges } from "./logger";

export interface ResultIdentifier {
  cacheConfig: CacheConfig["name"];
  cacheFactory: string;
}

export interface Result extends ResultIdentifier {
  scenario: `${(typeof scenarios)[number]["name"]}_${number}`;
  measurements: number[];
  executionTime: number;
  operationName: string;
}

interface BenchmarkJob {
  cacheFactory: (typeof cacheFactories)[number];
  cacheConfig: CacheConfig;
}

const cacheFactories = [
  {
    name: "baseline",
    importPath: "./forest-runs/baseline",
  },
  {
    name: "current",
    importPath: "./forest-runs/current",
  },
] as const;

// Generate all combinations of cache factories and configurations
const benchmarkJobs: BenchmarkJob[] = [];
for (const cacheFactory of cacheFactories) {
  for (const cacheConfig of CONFIG.cacheConfigurations) {
    benchmarkJobs.push({ cacheFactory, cacheConfig });
  }
}

/**
 * Run benchmark for a single cache implementation + configuration in an isolated process
 */
function runBenchmarkInIsolatedProcess(job: BenchmarkJob): Promise<Result[]> {
  return new Promise((resolve) => {
    const workerScript = path.join(__dirname, "benchmark-worker.ts");
    const child = spawn(
      process.execPath,
      [
        "--expose-gc",
        "-r",
        "ts-node/register",
        workerScript,
        JSON.stringify(job),
      ],
      {
        env: {
          ...process.env,
          TS_NODE_COMPILER_OPTIONS: '{"module":"commonjs"}',
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    let stdout = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      console.error(`stderr: ${data}`);
    });

    child.on("close", () => {
      const results = JSON.parse(stdout.trim());
      resolve(results);
    });
  });
}

async function runBenchmarkSuite(): Promise<Result[]> {
  const allResults: Result[] = [];

  // Run benchmark for each combination of cache factory + config in complete isolation
  for (const job of benchmarkJobs) {
    console.log(
      `\n=== Running benchmarks for ${job.cacheFactory.name} with ${job.cacheConfig.name} in isolated process ===`,
    );

    const jobResults = await runBenchmarkInIsolatedProcess(job);
    allResults.push(...jobResults);
    console.log(
      `Completed ${job.cacheFactory.name}/${job.cacheConfig.name} with ${jobResults.length} results`,
    );
  }

  return allResults;
}

export interface BenchmarkResult {
  [scenarioName: string]: Result[];
}

async function runBenchmarks(): Promise<void> {
  const { maxAttempts } = CONFIG.reliability;
  let prevBenchmarks: BenchmarkResult[] = [];
  log.start();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log.attempt(attempt);
    const currentResult = await runBenchmarkSuite();

    const groupedResults = groupResults(currentResult);

    const isReliable = isResultReliable(groupedResults, prevBenchmarks);

    prevBenchmarks.push(groupedResults);

    if (isReliable && attempt > CONFIG.reliability.minAttempts) {
      break;
    }
  }

  const summary = getSummary(prevBenchmarks);
  analyzeResults(summary);
  fs.writeFileSync("benchmark-summary.json", JSON.stringify(summary, null, 2));
}

runBenchmarks().catch(console.error);
