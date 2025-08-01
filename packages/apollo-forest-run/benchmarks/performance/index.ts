import * as fs from "fs";
import * as path from "path";
import { gql } from "@apollo/client";
import { ForestRun } from "../../src/ForestRun";
import NiceBenchmark, { BenchmarkSuiteResult } from "./nice-benchmark";
import { generateQueryMockData } from "./mock-data-generator";

interface BenchmarkConfig {
  iterations: number;
  operationsPerIteration: number;
  maxOperationCount: number;
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
    };
  }[];
}

// Load configuration
const configPath = path.join(__dirname, "config.json");
const config: BenchmarkConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

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

// Create ForestRun cache instance
function createCache() {
  return new ForestRun({ 
    maxOperationCount: config.maxOperationCount,
    resultCacheMaxSize: 0 
  });
}

// Generate test data for a query
function createTestData(queryKey: string, iteration: number) {
  const queryString = queryStrings[queryKey];
  const { variables, result } = generateQueryMockData(queryString, {}, {
    seed: iteration,
    arrayLength: 3,
  });
  return { variables, result };
}

// Benchmark write operations
async function benchmarkWrites(queryKey: string): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(`${queryKey} - Write Operations`);
  
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
  const suite = new NiceBenchmark(`${queryKey} - Read Operations`);
  
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

// Benchmark update operations
async function benchmarkUpdates(queryKey: string): Promise<BenchmarkSuiteResult> {
  const suite = new NiceBenchmark(`${queryKey} - Update Operations`);
  
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
  console.log(`Configuration: ${JSON.stringify(config, null, 2)}\n`);
  
  const results: BenchmarkReport['results'] = [];
  const queryKeys = Object.keys(config.queries);
  
  for (const queryKey of queryKeys) {
    console.log(`\n📊 Benchmarking: ${queryKey}`);
    
    const writeResults = await benchmarkWrites(queryKey);
    console.log(`  Write: ${writeResults.fastest[0]} - ${writeResults.benchmarks[0].opsPerSec.toFixed(2)} ops/sec`);
    
    const readResults = await benchmarkReads(queryKey);
    console.log(`  Read:  ${readResults.fastest[0]} - ${readResults.benchmarks[0].opsPerSec.toFixed(2)} ops/sec`);
    
    const updateResults = await benchmarkUpdates(queryKey);
    console.log(`  Update: ${updateResults.fastest[0]} - ${updateResults.benchmarks[0].opsPerSec.toFixed(2)} ops/sec`);
    
    results.push({
      queryName: queryKey,
      operations: {
        write: writeResults,
        read: readResults,
        update: updateResults,
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
    console.log(`  Write: ${operations.write.benchmarks[0].opsPerSec.toFixed(2)} ops/sec`);
    console.log(`  Read:  ${operations.read.benchmarks[0].opsPerSec.toFixed(2)} ops/sec`);
    console.log(`  Update: ${operations.update.benchmarks[0].opsPerSec.toFixed(2)} ops/sec`);
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