import * as fs from "fs";
import * as path from "path";
import { gql, DocumentNode } from "@apollo/client";
import { ForestRun } from "@graphitation/apollo-forest-run";
import NiceBenchmark, { BenchmarkSuiteResult } from "./nice-benchmark";
import { generate } from "@graphitation/graphql-js-operation-payload-generator";
import { buildSchema } from "graphql";
import * as os from "os";

interface BenchmarkConfig {
  iterations: number;
  operationsPerIteration: number;
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
      multipleObservers: BenchmarkSuiteResult;
    };
  }[];
}

// Simple GraphQL schema for generating mock data
const schema = buildSchema(`
  type Query {
    user(id: ID!): User
    post(id: ID!): Post
    product(id: ID!): Product
  }
  
  type User {
    id: ID!
    name: String!
    email: String!
    posts: [Post!]!
  }
  
  type Post {
    id: ID!
    title: String!
    content: String!
    author: User!
    comments: [Comment!]!
  }
  
  type Comment {
    id: ID!
    content: String!
    author: User!
  }
  
  type Product {
    id: ID!
    name: String!
    price: Float!
    reviews: [Review!]!
  }
  
  type Review {
    id: ID!
    rating: Int!
    comment: String!
    reviewer: User!
  }
`);

// Parse command line arguments
function parseArgs(): { confidenceLevel?: number; help?: boolean } {
  const args = process.argv.slice(2);
  const result: { confidenceLevel?: number; help?: boolean } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--confidence" || arg === "-c") {
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("-")) {
        const confidence = parseFloat(nextArg);
        if (!isNaN(confidence) && confidence > 0 && confidence <= 100) {
          result.confidenceLevel = confidence;
          i++; // Skip the next argument since we used it
        } else {
          console.error(
            `Error: Invalid confidence level "${nextArg}". Must be a number between 0 and 100.`,
          );
          process.exit(1);
        }
      } else {
        console.error(`Error: --confidence requires a value.`);
        process.exit(1);
      }
    }
  }

  return result;
}

function showHelp(): void {
  console.log(`
🚀 ForestRun Performance Benchmarks

Usage: yarn benchmark [options]

Options:
  --confidence, -c <level>  Set confidence level percentage (0-100)
                           Default: 95
  --help, -h               Show this help message

Examples:
  yarn benchmark                    # Use default 95% confidence
  yarn benchmark --confidence 99   # Use 99% confidence (high precision)
  yarn benchmark -c 90             # Use 90% confidence (faster)

Confidence Level Guide:
  90%   → Faster benchmarks, good precision
  95%   → Default, balanced precision/speed  
  99%   → High precision, longer benchmarks
  99.9% → Maximum precision, research-quality

Statistical Method:
  Uses margin of error percentage calculation: confidence = 100 - (moe / amean) * 100
  Runs samples in batches of 50 until target confidence is achieved
`);
}

// Load configuration
const configPath = path.join(__dirname, "config.json");
const config: BenchmarkConfig = JSON.parse(
  fs.readFileSync(configPath, "utf-8"),
);

// Override config with command line arguments if provided
const cliArgs = parseArgs();

if (cliArgs.help) {
  showHelp();
  process.exit(0);
}

// CLI args only override for this run, don't save to config
if (cliArgs.confidenceLevel !== undefined) {
  config.confidenceLevel = cliArgs.confidenceLevel;
}

// Load queries
const queries: Record<string, DocumentNode> = {};
const queryStrings: Record<string, string> = {};
const queriesDir = path.join(__dirname, "queries");

Object.entries(config.queries).forEach(([key, filename]) => {
  const queryPath = path.join(queriesDir, filename);
  const queryString = fs.readFileSync(queryPath, "utf-8");
  queryStrings[key] = queryString;
  queries[key] = gql(queryString);
});

// Create ForestRun cache instance with fixed settings
function createCache() {
  return new ForestRun({
    maxOperationCount: 100,
    resultCacheMaxSize: 0,
  });
}

// Generate test data for a query using graphql-js-operation-payload-generator
function createTestData(queryKey: string, iteration: number) {
  const query = queries[queryKey];
  const variables = { id: `test_${iteration}` };

  try {
    const payload = generate({
      request: { node: query, variables },
      schema,
    });

    return {
      variables,
      result: payload.data,
    };
  } catch (error) {
    // Fallback to simple mock data if generation fails
    return {
      variables,
      result: {
        id: `test_${iteration}`,
        name: `Test Item ${iteration}`,
        __typename: "User",
      },
    };
  }
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

  suite.add("ForestRun Write", async () => {
    const cache = createCache();
    const query = queries[queryKey];

    for (let i = 0; i < config.operationsPerIteration; i++) {
      const { variables, result } = createTestData(queryKey, i);
      cache.writeQuery({ query, variables, data: result });
    }
  });

  return suite.run();
}

// Benchmark read operations
async function benchmarkReads(queryKey: string): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(
    `${queryKey} - Read Operations`,
    config.confidenceLevel,
  );

  // Pre-populate cache
  const cache = createCache();
  const query = queries[queryKey];

  const testData = Array.from(
    { length: config.operationsPerIteration },
    (_, i) => createTestData(queryKey, i),
  );

  // Populate cache
  testData.forEach(({ variables, result }) => {
    cache.writeQuery({ query, variables, data: result });
  });

  suite.add("ForestRun Read", async () => {
    testData.forEach(({ variables }) => {
      cache.readQuery({ query, variables });
    });
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

  suite.add("ForestRun Empty Read", async () => {
    const cache = createCache();
    const query = queries[queryKey];

    for (let i = 0; i < config.operationsPerIteration; i++) {
      const { variables } = createTestData(queryKey, i);
      try {
        cache.readQuery({ query, variables });
      } catch (e) {
        // Expected - cache miss
      }
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

  suite.add("ForestRun Cache Miss", async () => {
    const cache = createCache();
    const query = queries[queryKey];

    // Populate some data (not the data we'll query)
    for (let i = 0; i < 50; i++) {
      const { variables, result } = createTestData(queryKey, i);
      cache.writeQuery({ query, variables, data: result });
    }

    // Try to read different data (cache miss)
    for (let i = 1000; i < 1000 + config.operationsPerIteration; i++) {
      const { variables } = createTestData(queryKey, i);
      try {
        cache.readQuery({ query, variables });
      } catch (e) {
        // Expected - cache miss
      }
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

  suite.add("ForestRun Cache Hit", async () => {
    const cache = createCache();
    const query = queries[queryKey];

    // Populate cache with data we'll query
    const testData = Array.from(
      { length: config.operationsPerIteration },
      (_, i) => createTestData(queryKey, i),
    );

    testData.forEach(({ variables, result }) => {
      cache.writeQuery({ query, variables, data: result });
    });

    // Read the same data (cache hits)
    testData.forEach(({ variables }) => {
      cache.readQuery({ query, variables });
    });
  });

  return suite.run();
}

// Benchmark multiple observers scenario
async function benchmarkMultipleObservers(
  queryKey: string,
): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(
    `${queryKey} - Multiple Observers`,
    config.confidenceLevel,
  );

  suite.add("ForestRun Multiple Observers", async () => {
    const cache = createCache();
    const query = queries[queryKey];

    // Simulate multiple observers watching the same queries
    const observerCount = 5;
    const { variables, result } = createTestData(queryKey, 0);

    // Write data once
    cache.writeQuery({ query, variables, data: result });

    // Simulate multiple observers reading the same data
    for (let i = 0; i < config.operationsPerIteration; i++) {
      for (let observer = 0; observer < observerCount; observer++) {
        cache.readQuery({ query, variables });
      }
    }
  });

  return suite.run();
}

async function benchmarkUpdates(
  queryKey: string,
): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(
    `${queryKey} - Update Operations`,
    config.confidenceLevel,
  );

  suite.add("ForestRun Update", async () => {
    const cache = createCache();
    const query = queries[queryKey];

    // Write initial data
    for (let i = 0; i < config.operationsPerIteration; i++) {
      const { variables, result } = createTestData(queryKey, i);
      cache.writeQuery({ query, variables, data: result });
    }

    // Update data
    for (let i = 0; i < config.operationsPerIteration; i++) {
      const { variables, result } = createTestData(queryKey, i + 1000);
      cache.writeQuery({ query, variables, data: result });
    }
  });

  return suite.run();
}

// Main benchmark runner with parallel execution across CPU cores
async function runBenchmarks(): Promise<BenchmarkReport> {
  console.log("🚀 ForestRun Performance Benchmarks");
  console.log(`📊 Configuration:`);
  console.log(`   Confidence Level: ${config.confidenceLevel}%`);
  console.log(`   CPU Cores: ${os.cpus().length}`);
  console.log("");

  const queryKeys = Object.keys(config.queries);

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
      () =>
        benchmarkMultipleObservers(queryKey).then((result) => ({
          queryKey,
          operation: "multipleObservers",
          result,
        })),
    );
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
    const multipleObserversResult = queryResults.find(
      (r) => r.operation === "multipleObservers",
    );

    if (
      !writeResult ||
      !readResult ||
      !updateResult ||
      !emptyReadResult ||
      !cacheMissResult ||
      !cacheHitResult ||
      !multipleObserversResult
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
        multipleObservers: multipleObserversResult.result,
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
      `  Multiple Observers: ${operations.multipleObservers.results[0].mean.toFixed(
        3,
      )}ms ±${operations.multipleObservers.results[0].rme.toFixed(2)}% (${
        operations.multipleObservers.results[0].samples
      } runs sampled, ${operations.multipleObservers.results[0].confidence.toFixed(
        1,
      )}% confidence)`,
    );
  });

  // Save report
  const reportPath = path.join(
    __dirname,
    `benchmark-report-${Date.now()}.json`,
  );
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Report saved to: ${reportPath}`);

  return report;
}

// CLI interface
if (require.main === module) {
  runBenchmarks().catch(console.error);
}

export { runBenchmarks };
export type { BenchmarkReport };
