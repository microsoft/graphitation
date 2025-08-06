import * as fs from "fs";
import * as path from "path";
import { gql } from "@apollo/client";
import { ForestRun } from "../../src/ForestRun";
import NiceBenchmark, { BenchmarkSuiteResult } from "./nice-benchmark";
import { generate } from "@graphitation/graphql-js-operation-payload-generator";
import { buildSchema } from "graphql";

interface BenchmarkConfig {
  iterations: number;
  operationsPerIteration: number;
  confidenceLevel: number;
  queries: Record<string, string>;
}

interface BenchmarkReport {
  timestamp: number;
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
    
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--confidence' || arg === '-c') {
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        const confidence = parseFloat(nextArg);
        if (!isNaN(confidence) && confidence > 0 && confidence <= 100) {
          result.confidenceLevel = confidence;
          i++; // Skip the next argument since we used it
        } else {
          console.error(`Error: Invalid confidence level "${nextArg}". Must be a number between 0 and 100.`);
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
  --confidence, -c <level>  Set confidence level (90, 95, 99, 99.9)
                           Default: 95
  --help, -h               Show this help message

Examples:
  yarn benchmark                    # Use default 95% confidence
  yarn benchmark --confidence 99   # Use 99% confidence (high precision)
  yarn benchmark -c 90             # Use 90% confidence (faster)

Available Confidence Levels:
  90%   → z = 1.645 (faster benchmarks, good precision)
  95%   → z = 1.96  (default, balanced precision/speed)
  99%   → z = 2.576 (high precision, longer benchmarks)
  99.9% → z = 3.291 (maximum precision, research-quality)
`);
}

// Load configuration
const configPath = path.join(__dirname, "config.json");
let config: BenchmarkConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

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
const queries: Record<string, any> = {};
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
    resultCacheMaxSize: 0 
  });
}

// Generate test data for a query using graphql-js-operation-payload-generator
function createTestData(queryKey: string, iteration: number) {
  const query = queries[queryKey];
  const variables = { id: `test_${iteration}` };
  
  try {
    const payload = generate({
      request: { node: query, variables },
      schema
    });
    
    return {
      variables,
      result: payload.data
    };
  } catch (error) {
    // Fallback to simple mock data if generation fails
    return {
      variables,
      result: {
        id: `test_${iteration}`,
        name: `Test Item ${iteration}`,
        __typename: "User"
      }
    };
  }
}

// Benchmark write operations
async function benchmarkWrites(queryKey: string): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(`${queryKey} - Write Operations`, config.confidenceLevel);
  
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
  const suite = new NiceBenchmark(`${queryKey} - Read Operations`, config.confidenceLevel);
  
  // Pre-populate cache
  const cache = createCache();
  const query = queries[queryKey];
  
  const testData = Array.from({ length: config.operationsPerIteration }, (_, i) => 
    createTestData(queryKey, i)
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
async function benchmarkEmptyReads(queryKey: string): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(`${queryKey} - Empty Cache Reads (Cache Miss)`, config.confidenceLevel);
  
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
async function benchmarkCacheMiss(queryKey: string): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(`${queryKey} - Cache Miss Operations`, config.confidenceLevel);
  
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
async function benchmarkCacheHit(queryKey: string): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(`${queryKey} - Cache Hit Operations`, config.confidenceLevel);
  
  suite.add("ForestRun Cache Hit", async () => {
    const cache = createCache();
    const query = queries[queryKey];
    
    // Populate cache with data we'll query
    const testData = Array.from({ length: config.operationsPerIteration }, (_, i) => 
      createTestData(queryKey, i)
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
async function benchmarkMultipleObservers(queryKey: string): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(`${queryKey} - Multiple Observers`, config.confidenceLevel);
  
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

async function benchmarkUpdates(queryKey: string): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(`${queryKey} - Update Operations`, config.confidenceLevel);
  
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

// Main benchmark runner
async function runBenchmarks(): Promise<BenchmarkReport> {
  console.log("🚀 ForestRun Performance Benchmarks");
  console.log(`📊 Configuration:`);
  console.log(`   Confidence Level: ${config.confidenceLevel}%`);
  console.log("");
  
  const results: BenchmarkReport['results'] = [];
  const queryKeys = Object.keys(config.queries);
  
  for (const queryKey of queryKeys) {
    console.log(`\n📊 Benchmarking: ${queryKey}`);
    
    const writeResults = await benchmarkWrites(queryKey);
    const readResults = await benchmarkReads(queryKey);
    const updateResults = await benchmarkUpdates(queryKey);
    const emptyReadResults = await benchmarkEmptyReads(queryKey);
    const cacheMissResults = await benchmarkCacheMiss(queryKey);
    const cacheHitResults = await benchmarkCacheHit(queryKey);
    const multipleObserversResults = await benchmarkMultipleObservers(queryKey);
    
    results.push({
      queryName: queryKey,
      operations: {
        write: writeResults,
        read: readResults,
        update: updateResults,
        emptyRead: emptyReadResults,
        cacheMiss: cacheMissResults,
        cacheHit: cacheHitResults,
        multipleObservers: multipleObserversResults,
      },
    });
  }
  
  const report: BenchmarkReport = {
    timestamp: Date.now(),
    config,
    results,
  };
  
  // Print summary
  console.log("\n📈 Performance Summary");
  console.log("====================");
  results.forEach(({ queryName, operations }) => {
    console.log(`${queryName}:`);
    console.log(`  Write: ${operations.write.benchmarks[0].mean.toFixed(3)}ms ±${operations.write.benchmarks[0].rme.toFixed(2)}% (${operations.write.benchmarks[0].confidenceLevel.toFixed(1)}% confidence)`);
    console.log(`  Read:  ${operations.read.benchmarks[0].mean.toFixed(3)}ms ±${operations.read.benchmarks[0].rme.toFixed(2)}% (${operations.read.benchmarks[0].confidenceLevel.toFixed(1)}% confidence)`);
    console.log(`  Update: ${operations.update.benchmarks[0].mean.toFixed(3)}ms ±${operations.update.benchmarks[0].rme.toFixed(2)}% (${operations.update.benchmarks[0].confidenceLevel.toFixed(1)}% confidence)`);
    console.log(`  Empty Read: ${operations.emptyRead.benchmarks[0].mean.toFixed(3)}ms ±${operations.emptyRead.benchmarks[0].rme.toFixed(2)}% (${operations.emptyRead.benchmarks[0].confidenceLevel.toFixed(1)}% confidence)`);
    console.log(`  Cache Miss: ${operations.cacheMiss.benchmarks[0].mean.toFixed(3)}ms ±${operations.cacheMiss.benchmarks[0].rme.toFixed(2)}% (${operations.cacheMiss.benchmarks[0].confidenceLevel.toFixed(1)}% confidence)`);
    console.log(`  Cache Hit: ${operations.cacheHit.benchmarks[0].mean.toFixed(3)}ms ±${operations.cacheHit.benchmarks[0].rme.toFixed(2)}% (${operations.cacheHit.benchmarks[0].confidenceLevel.toFixed(1)}% confidence)`);
    console.log(`  Multiple Observers: ${operations.multipleObservers.benchmarks[0].mean.toFixed(3)}ms ±${operations.multipleObservers.benchmarks[0].rme.toFixed(2)}% (${operations.multipleObservers.benchmarks[0].confidenceLevel.toFixed(1)}% confidence)`);
  });
  
  // Save report
  const reportPath = path.join(__dirname, `benchmark-report-${Date.now()}.json`);
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