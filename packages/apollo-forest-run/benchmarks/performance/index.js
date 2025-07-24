const fs = require("fs");
const path = require("path");
const { gql, InMemoryCache } = require("@apollo/client");
const { ForestRun } = require("../../lib/ForestRun");
const { Suite } = require("benchmark");

// Simple benchmark class
class NiceBenchmark {
  constructor(name) {
    this.name = name;
    this.suite = new Suite(name);
    this.results = [];
    
    this.suite.on("cycle", (event) => {
      const benchmark = event.target;
      const result = {
        name: benchmark.name,
        hz: benchmark.hz,
        rme: benchmark.stats.rme,
        samples: benchmark.stats.sample.length,
        mean: benchmark.stats.mean,
        variance: benchmark.stats.variance,
      };
      this.results.push(result);
      console.log(String(event.target));
    });
  }

  add(name, fn) {
    this.suite.add(name, {
      defer: true,
      fn: async (deferred) => {
        await fn();
        deferred.resolve();
      },
    });
  }

  run(options) {
    return new Promise((resolve) => {
      this.suite.on("complete", () => {
        const fastest = this.suite.filter("fastest").map("name")[0];
        const slowest = this.suite.filter("slowest").map("name")[0];
        
        const result = {
          suiteName: this.name,
          results: this.results,
          timestamp: Date.now(),
          fastest,
          slowest,
        };
        
        console.log(`Fastest is ${fastest}`);
        resolve(result);
      });
      console.log(`\n=== ${this.name} ===`);
      this.suite.run(options);
    });
  }
}

// Load configuration
const configPath = path.join(__dirname, "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// Load queries
const queries = {};
const queriesDir = path.join(__dirname, "queries");

Object.entries(config.queries).forEach(([key, filename]) => {
  const queryPath = path.join(queriesDir, filename);
  const queryString = fs.readFileSync(queryPath, "utf-8");
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

// Generate test data
function generateRandomString(length) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function createTestData(queryKey, iteration) {
  const baseId = `${queryKey}_${iteration}_${generateRandomString(8)}`;
  
  if (queryKey === "simple") {
    return {
      variables: { id: baseId },
      result: {
        __typename: "Query",
        node: {
          __typename: "Node",
          id: baseId,
        },
      },
    };
  }
  
  // Default to simple for now
  return {
    variables: { id: baseId },
    result: {
      __typename: "Query",
      node: {
        __typename: "Node",
        id: baseId,
      },
    },
  };
}

// Benchmark operations
async function benchmarkWrites(queryKey) {
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

async function benchmarkReads(queryKey) {
  const suite = new NiceBenchmark(`Read Operations - ${queryKey}`);
  
  // Pre-populate caches
  const forestRunCache = createForestRun();
  const inMemoryCache = createInMemoryCache();
  const query = queries[queryKey];
  
  const testData = [];
  for (let i = 0; i < config.operationsPerIteration; i++) {
    testData.push(createTestData(queryKey, i));
  }
  
  // Populate both caches with the same data
  testData.forEach(({ variables, result }) => {
    forestRunCache.writeQuery({ query, variables, data: result });
    inMemoryCache.writeQuery({ query, variables, data: result });
  });
  
  suite.add("ForestRun - Read", async () => {
    testData.forEach(({ variables }) => {
      try {
        forestRunCache.readQuery({ query, variables });
      } catch (error) {
        // Ignore read errors for benchmarking
      }
    });
  });
  
  suite.add("InMemoryCache - Read", async () => {
    testData.forEach(({ variables }) => {
      try {
        inMemoryCache.readQuery({ query, variables });
      } catch (error) {
        // Ignore read errors for benchmarking
      }
    });
  });
  
  return suite.run();
}

async function benchmarkUpdates(queryKey) {
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
async function runBenchmarks() {
  console.log("🚀 Starting ForestRun Performance Benchmarks");
  console.log(`Configuration: ${JSON.stringify(config, null, 2)}\n`);
  
  const suites = [];
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
  const forestRunFaster = [];
  const inMemoryCacheFaster = [];
  
  suites.forEach(suite => {
    if (suite.fastest.includes("ForestRun")) {
      forestRunFaster.push(suite.suiteName);
    } else if (suite.fastest.includes("InMemoryCache")) {
      inMemoryCacheFaster.push(suite.suiteName);
    }
  });
  
  const report = {
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

module.exports = { runBenchmarks };