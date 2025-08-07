import * as fs from "fs";
import * as path from "path";
import { gql, DocumentNode } from "@apollo/client";
import { ForestRun } from "@graphitation/apollo-forest-run";
import NiceBenchmark, { BenchmarkSuiteResult } from "./nice-benchmark";
import * as os from "os";

interface BenchmarkConfig {
  iterations: number;
  confidenceLevel: number;
  queries: Record<string, string>;
}

interface BenchmarkReport {
  config: BenchmarkConfig;
  results: {
    queryName: string;
    operations: {
      write: BenchmarkSuiteResult;
      read: BenchmarkSuiteResult;
      update: BenchmarkSuiteResult;
      emptyRead: BenchmarkSuiteResult;
      cacheMiss: BenchmarkSuiteResult;
      cacheHit: BenchmarkSuiteResult;
      multipleObservers5: BenchmarkSuiteResult;
      multipleObservers20: BenchmarkSuiteResult;
      multipleObservers50: BenchmarkSuiteResult;
      multipleObservers100: BenchmarkSuiteResult;
    };
  }[];
}



// Load configuration with fixed confidence level
const configPath = path.join(__dirname, "config.json");
const config: BenchmarkConfig = JSON.parse(
  fs.readFileSync(configPath, "utf-8"),
);

// Set fixed confidence level to 99.5%
config.confidenceLevel = 99.5;

// Load queries and their corresponding static responses
const queries: Record<string, DocumentNode> = {};
const queryStrings: Record<string, string> = {};
const queryResponses: Record<string, any> = {};
const queriesDir = path.join(__dirname, "queries");
const responsesDir = path.join(__dirname, "responses");

Object.entries(config.queries).forEach(([key, filename]) => {
  const queryPath = path.join(queriesDir, filename);
  const responsePath = path.join(responsesDir, filename.replace('.graphql', '.json'));
  
  const queryString = fs.readFileSync(queryPath, "utf-8");
  const responseData = JSON.parse(fs.readFileSync(responsePath, "utf-8"));
  
  queryStrings[key] = queryString;
  queries[key] = gql(queryString);
  queryResponses[key] = responseData;
});

// Create ForestRun cache instance with enhanced settings for better results
function createCache() {
  return new ForestRun({
    maxOperationCount: 500, // Increased from 100 for better results
    resultCacheMaxSize: 0,
  });
}

// Get consistent test data for a query (same data for all tests)
function getTestData(queryKey: string) {
  const baseVariables = { id: "test_consistent_id" };
  const result = queryResponses[queryKey];
  
  return {
    variables: baseVariables,
    result: result,
  };
}

// Simple worker pool for CPU-bound parallel execution
class SimpleWorkerPool {
  private numWorkers: number;
  private tasks: Array<() => Promise<unknown>> = [];
  private results: unknown[] = [];

  constructor(numWorkers: number = os.cpus().length) {
    this.numWorkers = Math.min(numWorkers, os.cpus().length);
  }

  async execute<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
    const chunks = this.chunkArray(
      tasks,
      Math.ceil(tasks.length / this.numWorkers),
    );
    const workerPromises = chunks.map((chunk) => this.executeChunk(chunk));
    const chunkResults = await Promise.all(workerPromises);
    return chunkResults.flat();
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private async executeChunk<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
    const results: T[] = [];
    for (const task of tasks) {
      results.push(await task());
    }
    return results;
  }
}

// Benchmark write operations
async function benchmarkWrites(
  queryKey: string,
): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(
    `${queryKey} - Write Operations`,
    config.confidenceLevel,
  );

  // Pre-create test data outside of measurement
  const query = queries[queryKey];
  const { variables, result } = getTestData(queryKey);

  suite.add("ForestRun Write", () => {
    const cache = createCache();
    // Measure only the core writeQuery operation
    cache.writeQuery({ query, variables, data: result });
  });

  return suite.run();
}

// Benchmark read operations
async function benchmarkReads(queryKey: string): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(
    `${queryKey} - Read Operations`,
    config.confidenceLevel,
  );

  // Pre-populate cache and prepare test data outside of measurement
  const cache = createCache();
  const query = queries[queryKey];
  const { variables, result } = getTestData(queryKey);

  // Populate cache once
  cache.writeQuery({ query, variables, data: result });

  suite.add("ForestRun Read", () => {
    // Measure only the core readQuery operation
    cache.readQuery({ query, variables });
  });

  return suite.run();
}

// Benchmark empty cache read operations (cache misses)
async function benchmarkEmptyReads(
  queryKey: string,
): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(
    `${queryKey} - Empty Cache Reads (Cache Miss)`,
    config.confidenceLevel,
  );

  // Pre-create cache and test data outside of measurement
  const cache = createCache();
  const query = queries[queryKey];
  const { variables } = getTestData(queryKey);

  suite.add("ForestRun Empty Read", () => {
    // Measure only the core readQuery operation on empty cache
    try {
      cache.readQuery({ query, variables });
    } catch (e) {
      // Expected - cache miss
    }
  });

  return suite.run();
}

// Benchmark cache miss vs hit scenarios
async function benchmarkCacheMiss(
  queryKey: string,
): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(
    `${queryKey} - Cache Miss Operations`,
    config.confidenceLevel,
  );

  // Pre-prepare cache and test data outside of measurement
  const cache = createCache();
  const query = queries[queryKey];
  const { variables, result } = getTestData(queryKey);

  // Populate cache with the known data once
  cache.writeQuery({ query, variables, data: result });

  // Prepare different variables for cache miss
  const missVariables = { id: "different_id_not_in_cache" };

  suite.add("ForestRun Cache Miss", () => {
    // Measure only the core readQuery operation (cache miss)
    try {
      cache.readQuery({ query, variables: missVariables });
    } catch (e) {
      // Expected - cache miss
    }
  });

  return suite.run();
}

// Benchmark cache hit scenarios
async function benchmarkCacheHit(
  queryKey: string,
): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(
    `${queryKey} - Cache Hit Operations`,
    config.confidenceLevel,
  );

  // Pre-prepare cache and test data outside of measurement
  const cache = createCache();
  const query = queries[queryKey];
  const { variables, result } = getTestData(queryKey);

  // Populate cache with data we'll query once
  cache.writeQuery({ query, variables, data: result });

  suite.add("ForestRun Cache Hit", () => {
    // Measure only the core readQuery operation (cache hit)
    cache.readQuery({ query, variables });
  });

  return suite.run();
}

// Benchmark multiple observers scenario with configurable observer count
async function benchmarkMultipleObservers(
  queryKey: string,
  observerCount: number,
): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(
    `${queryKey} - Multiple Observers (${observerCount})`,
    config.confidenceLevel,
  );

  // Pre-prepare cache and test data outside of measurement
  const cache = createCache();
  const query = queries[queryKey];
  const { variables, result } = getTestData(queryKey);

  // Write initial data once
  cache.writeQuery({ query, variables, data: result });

  // Setup observers (watchers) outside of measurement
  const unsubscribeFunctions: Array<() => void> = [];
  
  for (let observer = 0; observer < observerCount; observer++) {
    const unsubscribe = cache.watch({
      query,
      variables,
      optimistic: true,
      callback: () => {
        // Observer callback - called when cache updates
      },
    });
    unsubscribeFunctions.push(unsubscribe);
  }

  suite.add(`ForestRun ${observerCount} Observers`, () => {
    // Measure only the cache update operation with active observers
    cache.writeQuery({ query, variables, data: result });
  });

  // Cleanup observers after benchmark
  const originalRun = suite.run.bind(suite);
  suite.run = async (options?: unknown) => {
    const result = await originalRun(options);
    unsubscribeFunctions.forEach(unsub => unsub());
    return result;
  };

  return suite.run();
}

async function benchmarkUpdates(
  queryKey: string,
): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(
    `${queryKey} - Update Operations`,
    config.confidenceLevel,
  );

  // Pre-prepare cache and test data outside of measurement
  const cache = createCache();
  const query = queries[queryKey];
  const { variables, result } = getTestData(queryKey);

  // Write initial data once
  cache.writeQuery({ query, variables, data: result });

  suite.add("ForestRun Update", () => {
    // Measure only the core writeQuery operation (update/overwrite)
    cache.writeQuery({ query, variables, data: result });
  });

  return suite.run();
}

// Main benchmark runner with parallel execution across CPU cores and reliability checking
async function runBenchmarks(): Promise<BenchmarkReport> {
  console.log("🚀 ForestRun Performance Benchmarks");
  console.log(`📊 Configuration:`);
  console.log(`   Confidence Level: ${config.confidenceLevel}%`);
  console.log(`   CPU Cores: ${os.cpus().length}`);
  console.log("");

  const maxReliabilityRuns = 5; // Maximum times to run the entire suite for reliability
  const reliabilityThreshold = 10; // Accept if consecutive runs differ by less than 10%
  
  let reliableResults: BenchmarkReport | null = null;
  let consecutiveGoodRuns = 0;
  const requiredConsecutiveRuns = 2; // Need 2 consecutive stable runs

  for (let attempt = 1; attempt <= maxReliabilityRuns; attempt++) {
    console.log(`🔄 Running benchmark suite (attempt ${attempt}/${maxReliabilityRuns})...`);
    
    const currentResults = await runSingleBenchmarkSuite();
    
    if (attempt === 1) {
      reliableResults = currentResults;
      consecutiveGoodRuns = 1;
      continue;
    }

    // Check if current results are reliable compared to previous
    const isReliable = checkResultsReliability(reliableResults!, currentResults, reliabilityThreshold);
    
    if (isReliable) {
      consecutiveGoodRuns++;
      console.log(`✅ Results are reliable (±${reliabilityThreshold}% threshold), consecutive: ${consecutiveGoodRuns}`);
      
      if (consecutiveGoodRuns >= requiredConsecutiveRuns) {
        console.log(`🎯 Achieved reliable results after ${attempt} attempts`);
        break;
      }
    } else {
      console.log(`⚠️  Results vary significantly, running again...`);
      consecutiveGoodRuns = 1; // Reset counter
    }
    
    reliableResults = currentResults; // Update to latest results
  }

  if (consecutiveGoodRuns < requiredConsecutiveRuns) {
    console.log(`⚠️  Warning: Could not achieve fully reliable results after ${maxReliabilityRuns} attempts`);
  }

  // Save final report
  const reportPath = path.join(
    __dirname,
    `benchmark-report-${Date.now()}.json`,
  );
  fs.writeFileSync(reportPath, JSON.stringify(reliableResults, null, 2));
  console.log(`\n💾 Report saved to: ${reportPath}`);

  return reliableResults!;
}

// Check if two benchmark results are reliable (within threshold)
function checkResultsReliability(
  baseline: BenchmarkReport,
  current: BenchmarkReport,
  thresholdPercent: number
): boolean {
  for (const currentResult of current.results) {
    const baselineResult = baseline.results.find(
      (r) => r.queryName === currentResult.queryName,
    );

    if (!baselineResult) continue;

    // Check all operations for reliability
    const operations: Array<keyof typeof currentResult.operations> = [
      "write", "read", "update", "emptyRead", "cacheMiss", "cacheHit",
      "multipleObservers5", "multipleObservers20", "multipleObservers50", "multipleObservers100",
    ];

    for (const operation of operations) {
      const baselineOp = baselineResult.operations[operation];
      const currentOp = currentResult.operations[operation];

      if (baselineOp.results[0] && currentOp.results[0]) {
        const baselineMean = baselineOp.results[0].mean;
        const currentMean = currentOp.results[0].mean;
        const changePercent = Math.abs(((currentMean - baselineMean) / baselineMean) * 100);

        if (changePercent > thresholdPercent) {
          return false; // Found a significant difference
        }
      }
    }
  }

  return true; // All operations are within threshold
}

// Run a single benchmark suite (the original runBenchmarks logic)
async function runSingleBenchmarkSuite(): Promise<BenchmarkReport> {

  const queryKeys = Object.keys(config.queries);
  const observerCounts = [5, 20, 50, 100];

  // Create all benchmark tasks to run in parallel
  const benchmarkTasks: Array<
    () => Promise<{
      queryKey: string;
      operation: string;
      result: BenchmarkSuiteResult;
    }>
  > = [];

  for (const queryKey of queryKeys) {
    benchmarkTasks.push(
      () =>
        benchmarkWrites(queryKey).then((result) => ({
          queryKey,
          operation: "write",
          result,
        })),
      () =>
        benchmarkReads(queryKey).then((result) => ({
          queryKey,
          operation: "read",
          result,
        })),
      () =>
        benchmarkUpdates(queryKey).then((result) => ({
          queryKey,
          operation: "update",
          result,
        })),
      () =>
        benchmarkEmptyReads(queryKey).then((result) => ({
          queryKey,
          operation: "emptyRead",
          result,
        })),
      () =>
        benchmarkCacheMiss(queryKey).then((result) => ({
          queryKey,
          operation: "cacheMiss",
          result,
        })),
      () =>
        benchmarkCacheHit(queryKey).then((result) => ({
          queryKey,
          operation: "cacheHit",
          result,
        })),
    );

    // Add multiple observer benchmarks for different observer counts
    for (const observerCount of observerCounts) {
      benchmarkTasks.push(
        () =>
          benchmarkMultipleObservers(queryKey, observerCount).then((result) => ({
            queryKey,
            operation: `multipleObservers${observerCount}`,
            result,
          })),
      );
    }
  }

  // Execute benchmarks in parallel across CPU cores
  const workerPool = new SimpleWorkerPool();
  const benchmarkResults = await workerPool.execute(benchmarkTasks);

  // Group results by query
  const results = queryKeys.map((queryKey) => {
    const queryResults = benchmarkResults.filter(
      (r) => r.queryKey === queryKey,
    );

    const writeResult = queryResults.find((r) => r.operation === "write");
    const readResult = queryResults.find((r) => r.operation === "read");
    const updateResult = queryResults.find((r) => r.operation === "update");
    const emptyReadResult = queryResults.find(
      (r) => r.operation === "emptyRead",
    );
    const cacheMissResult = queryResults.find(
      (r) => r.operation === "cacheMiss",
    );
    const cacheHitResult = queryResults.find((r) => r.operation === "cacheHit");
    const multipleObservers5Result = queryResults.find(
      (r) => r.operation === "multipleObservers5",
    );
    const multipleObservers20Result = queryResults.find(
      (r) => r.operation === "multipleObservers20",
    );
    const multipleObservers50Result = queryResults.find(
      (r) => r.operation === "multipleObservers50",
    );
    const multipleObservers100Result = queryResults.find(
      (r) => r.operation === "multipleObservers100",
    );

    if (
      !writeResult ||
      !readResult ||
      !updateResult ||
      !emptyReadResult ||
      !cacheMissResult ||
      !cacheHitResult ||
      !multipleObservers5Result ||
      !multipleObservers20Result ||
      !multipleObservers50Result ||
      !multipleObservers100Result
    ) {
      throw new Error(`Missing benchmark results for query: ${queryKey}`);
    }

    return {
      queryName: queryKey,
      operations: {
        write: writeResult.result,
        read: readResult.result,
        update: updateResult.result,
        emptyRead: emptyReadResult.result,
        cacheMiss: cacheMissResult.result,
        cacheHit: cacheHitResult.result,
        multipleObservers5: multipleObservers5Result.result,
        multipleObservers20: multipleObservers20Result.result,
        multipleObservers50: multipleObservers50Result.result,
        multipleObservers100: multipleObservers100Result.result,
      },
    };
  });

  const report: BenchmarkReport = {
    config,
    results,
  };

  // Print summary
  console.log("\n📈 Performance Summary");
  console.log("====================");
  results.forEach(({ queryName, operations }) => {
    console.log(`${queryName}:`);
    console.log(
      `  Write: ${operations.write.results[0].mean.toFixed(
        3,
      )}ms ±${operations.write.results[0].rme.toFixed(2)}% (${
        operations.write.results[0].samples
      } runs sampled, ${operations.write.results[0].confidence.toFixed(
        1,
      )}% confidence)`,
    );
    console.log(
      `  Read:  ${operations.read.results[0].mean.toFixed(
        3,
      )}ms ±${operations.read.results[0].rme.toFixed(2)}% (${
        operations.read.results[0].samples
      } runs sampled, ${operations.read.results[0].confidence.toFixed(
        1,
      )}% confidence)`,
    );
    console.log(
      `  Update: ${operations.update.results[0].mean.toFixed(
        3,
      )}ms ±${operations.update.results[0].rme.toFixed(2)}% (${
        operations.update.results[0].samples
      } runs sampled, ${operations.update.results[0].confidence.toFixed(
        1,
      )}% confidence)`,
    );
    console.log(
      `  Empty Read: ${operations.emptyRead.results[0].mean.toFixed(
        3,
      )}ms ±${operations.emptyRead.results[0].rme.toFixed(2)}% (${
        operations.emptyRead.results[0].samples
      } runs sampled, ${operations.emptyRead.results[0].confidence.toFixed(
        1,
      )}% confidence)`,
    );
    console.log(
      `  Cache Miss: ${operations.cacheMiss.results[0].mean.toFixed(
        3,
      )}ms ±${operations.cacheMiss.results[0].rme.toFixed(2)}% (${
        operations.cacheMiss.results[0].samples
      } runs sampled, ${operations.cacheMiss.results[0].confidence.toFixed(
        1,
      )}% confidence)`,
    );
    console.log(
      `  Cache Hit: ${operations.cacheHit.results[0].mean.toFixed(
        3,
      )}ms ±${operations.cacheHit.results[0].rme.toFixed(2)}% (${
        operations.cacheHit.results[0].samples
      } runs sampled, ${operations.cacheHit.results[0].confidence.toFixed(
        1,
      )}% confidence)`,
    );
    console.log(
      `  5 Observers: ${operations.multipleObservers5.results[0].mean.toFixed(
        3,
      )}ms ±${operations.multipleObservers5.results[0].rme.toFixed(2)}% (${
        operations.multipleObservers5.results[0].samples
      } runs sampled, ${operations.multipleObservers5.results[0].confidence.toFixed(
        1,
      )}% confidence)`,
    );
    console.log(
      `  20 Observers: ${operations.multipleObservers20.results[0].mean.toFixed(
        3,
      )}ms ±${operations.multipleObservers20.results[0].rme.toFixed(2)}% (${
        operations.multipleObservers20.results[0].samples
      } runs sampled, ${operations.multipleObservers20.results[0].confidence.toFixed(
        1,
      )}% confidence)`,
    );
    console.log(
      `  50 Observers: ${operations.multipleObservers50.results[0].mean.toFixed(
        3,
      )}ms ±${operations.multipleObservers50.results[0].rme.toFixed(2)}% (${
        operations.multipleObservers50.results[0].samples
      } runs sampled, ${operations.multipleObservers50.results[0].confidence.toFixed(
        1,
      )}% confidence)`,
    );
    console.log(
      `  100 Observers: ${operations.multipleObservers100.results[0].mean.toFixed(
        3,
      )}ms ±${operations.multipleObservers100.results[0].rme.toFixed(2)}% (${
        operations.multipleObservers100.results[0].samples
      } runs sampled, ${operations.multipleObservers100.results[0].confidence.toFixed(
        1,
      )}% confidence)`,
    );
  });

  return report;
}

// CLI interface
if (require.main === module) {
  runBenchmarks().catch(console.error);
}

export { runBenchmarks };
export type { BenchmarkReport };
