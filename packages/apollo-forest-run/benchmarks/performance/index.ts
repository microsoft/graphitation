import * as fs from "fs";
import * as path from "path";
import { gql, InMemoryCache } from "@apollo/client";
import { ForestRun } from "../../src/ForestRun";
import NiceBenchmark, { BenchmarkSuiteResult } from "./nice-benchmark";
import { generateQueryMockData } from "./mock-data-generator";

interface BenchmarkConfig {
  iterations: number;
  warmupIterations: number;
  operationsPerIteration: number;
  maxOperationCount: number;
  confidence: {
    level: number;
    minSamples: number;
    maxSamples: number;
  };
  queries: Record<string, string>;
}

interface BenchmarkReport {
  timestamp: number;
  config: BenchmarkConfig;
  suites: BenchmarkSuiteResult[];
  summary: {
    forestRunFaster: string[];
    inMemoryCacheFaster: string[];
    totalTests: number;
  };
}

// Load configuration
const configPath = path.join(__dirname, "config.json");
const config: BenchmarkConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// Load queries and prepare mock data generators
const queries: Record<string, any> = {};
const queryStrings: Record<string, string> = {};
const queriesDir = path.join(__dirname, "queries");

Object.entries(config.queries).forEach(([key, filename]) => {
  const queryPath = path.join(queriesDir, filename);
  const queryString = fs.readFileSync(queryPath, "utf-8");
  queryStrings[key] = queryString;
  queries[key] = gql(queryString);
});

// Create cache instances
function createForestRun() {
  return new ForestRun({ 
    maxOperationCount: config.maxOperationCount,
    resultCacheMaxSize: 0 
  });
}

function createInMemoryCache() {
  return new InMemoryCache({ 
    resultCacheMaxSize: 0 
  });
}

// Generate test data dynamically based on GraphQL query structure
function createTestData(queryKey: string, iteration: number) {
  const queryString = queryStrings[queryKey];
  
  if (!queryString) {
    throw new Error(`Query not found: ${queryKey}`);
  }

  // Generate unique variables for this iteration
  const baseVariables: Record<string, any> = {};
  
  // Add iteration-specific uniqueness to ID variables
  const iterationId = `${queryKey}_${iteration}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Generate mock data using the dynamic generator
  const { variables, result } = generateQueryMockData(queryString, { 
    id: iterationId,
    ...baseVariables 
  }, {
    seed: iteration, // Use iteration as seed for deterministic but varied data
    arrayLength: 3,
    stringLength: 10,
  });

  return { variables, result };
}

// Benchmark operations
async function benchmarkWrites(queryKey: string): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(`Write Operations - ${queryKey}`);
  
  suite.add("ForestRun - Write", async () => {
    const cache = createForestRun();
    const query = queries[queryKey];
    
    for (let i = 0; i < config.operationsPerIteration; i++) {
      const { variables, result } = createTestData(queryKey, i);
      cache.writeQuery({
        query,
        variables,
        data: result,
      });
    }
  });
  
  suite.add("InMemoryCache - Write", async () => {
    const cache = createInMemoryCache();
    const query = queries[queryKey];
    
    for (let i = 0; i < config.operationsPerIteration; i++) {
      const { variables, result } = createTestData(queryKey, i);
      cache.writeQuery({
        query,
        variables,
        data: result,
      });
    }
  });
  
  return suite.run();
}

async function benchmarkReads(queryKey: string): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(`Read Operations - ${queryKey}`);
  
  // Pre-populate caches
  const forestRunCache = createForestRun();
  const inMemoryCache = createInMemoryCache();
  const query = queries[queryKey];
  
  const testData = Array.from({ length: config.operationsPerIteration }, (_, i) => 
    createTestData(queryKey, i)
  );
  
  // Populate both caches with the same data
  testData.forEach(({ variables, result }) => {
    forestRunCache.writeQuery({ query, variables, data: result });
    inMemoryCache.writeQuery({ query, variables, data: result });
  });
  
  suite.add("ForestRun - Read", async () => {
    testData.forEach(({ variables }) => {
      forestRunCache.readQuery({ query, variables });
    });
  });
  
  suite.add("InMemoryCache - Read", async () => {
    testData.forEach(({ variables }) => {
      inMemoryCache.readQuery({ query, variables });
    });
  });
  
  return suite.run();
}

async function benchmarkUpdates(queryKey: string): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(`Update Operations - ${queryKey}`);
  
  suite.add("ForestRun - Update", async () => {
    const cache = createForestRun();
    const query = queries[queryKey];
    
    // Write initial data
    for (let i = 0; i < config.operationsPerIteration; i++) {
      const { variables, result } = createTestData(queryKey, i);
      cache.writeQuery({ query, variables, data: result });
    }
    
    // Update data
    for (let i = 0; i < config.operationsPerIteration; i++) {
      const { variables, result } = createTestData(queryKey, i + 1000); // Different data
      cache.writeQuery({ query, variables, data: result });
    }
  });
  
  suite.add("InMemoryCache - Update", async () => {
    const cache = createInMemoryCache();
    const query = queries[queryKey];
    
    // Write initial data
    for (let i = 0; i < config.operationsPerIteration; i++) {
      const { variables, result } = createTestData(queryKey, i);
      cache.writeQuery({ query, variables, data: result });
    }
    
    // Update data
    for (let i = 0; i < config.operationsPerIteration; i++) {
      const { variables, result } = createTestData(queryKey, i + 1000); // Different data
      cache.writeQuery({ query, variables, data: result });
    }
  });
  
  return suite.run();
}

// Main benchmark runner
async function runBenchmarks(): Promise<BenchmarkReport> {
  console.log("🚀 Starting ForestRun Performance Benchmarks");
  console.log(`Configuration: ${JSON.stringify(config, null, 2)}\n`);
  
  const suites: BenchmarkSuiteResult[] = [];
  const queryKeys = Object.keys(config.queries);
  
  for (const queryKey of queryKeys) {
    console.log(`\n📊 Benchmarking query: ${queryKey}`);
    
    // Run write benchmarks
    const writeResults = await benchmarkWrites(queryKey);
    suites.push(writeResults);
    
    // Run read benchmarks
    const readResults = await benchmarkReads(queryKey);
    suites.push(readResults);
    
    // Run update benchmarks
    const updateResults = await benchmarkUpdates(queryKey);
    suites.push(updateResults);
  }
  
  // Generate summary
  const forestRunFaster: string[] = [];
  const inMemoryCacheFaster: string[] = [];
  
  suites.forEach(suite => {
    if (suite.fastest.includes("ForestRun")) {
      forestRunFaster.push(suite.suiteName);
    } else if (suite.fastest.includes("InMemoryCache")) {
      inMemoryCacheFaster.push(suite.suiteName);
    }
  });
  
  const report: BenchmarkReport = {
    timestamp: Date.now(),
    config,
    suites,
    summary: {
      forestRunFaster,
      inMemoryCacheFaster,
      totalTests: suites.length,
    },
  };
  
  // Print summary
  console.log("\n📈 Benchmark Summary");
  console.log("==================");
  console.log(`Total benchmark suites: ${report.summary.totalTests}`);
  console.log(`ForestRun faster in: ${forestRunFaster.length} suites`);
  console.log(`InMemoryCache faster in: ${inMemoryCacheFaster.length} suites`);
  
  if (forestRunFaster.length > 0) {
    console.log("\n🏆 ForestRun was faster in:");
    forestRunFaster.forEach(suite => console.log(`  - ${suite}`));
  }
  
  if (inMemoryCacheFaster.length > 0) {
    console.log("\n🥈 InMemoryCache was faster in:");
    inMemoryCacheFaster.forEach(suite => console.log(`  - ${suite}`));
  }
  
  // Save report
  const reportPath = path.join(__dirname, `benchmark-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Full report saved to: ${reportPath}`);
  
  return report;
}

// CLI interface
if (require.main === module) {
  runBenchmarks().catch(console.error);
}

export { runBenchmarks };
export type { BenchmarkReport };