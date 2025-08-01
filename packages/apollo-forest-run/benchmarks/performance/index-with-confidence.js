const fs = require("fs");
const path = require("path");
const { gql } = require("@apollo/client");
const { ForestRun } = require("../../lib/ForestRun");
const { generateQueryMockData } = require("./mock-data-generator");

// Load configuration
const configPath = path.join(__dirname, "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// Parse command line arguments for confidence level override
function parseCommandLineArgs() {
  const args = process.argv.slice(2);
  const result = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--confidence' || arg === '-c') {
      const nextArg = args[i + 1];
      if (nextArg && !isNaN(Number(nextArg))) {
        const confidence = Number(nextArg);
        if (confidence > 0 && confidence < 100) {
          result.confidenceLevel = confidence;
          i++; // Skip the next argument as it's the confidence value
        } else {
          console.warn(`Warning: Invalid confidence level ${confidence}. Must be between 0 and 100.`);
        }
      } else {
        console.warn('Warning: --confidence requires a numeric value');
      }
    }
  }
  
  return result;
}

// Override config with command line arguments
const cliArgs = parseCommandLineArgs();
const finalConfig = {
  ...config,
  confidenceLevel: cliArgs.confidenceLevel ?? config.confidenceLevel
};

// Custom benchmark class with configurable confidence
class NiceBenchmark {
  constructor(name, options = {}) {
    this.name = name;
    this.benchmarks = [];
    this.results = [];
    this.confidenceLevel = options.confidenceLevel || 95;
  }

  add(name, fn) {
    this.benchmarks.push({ name, fn });
  }

  // Calculate z-score for given confidence level
  getZScore(confidenceLevel) {
    // Common confidence levels and their z-scores
    const zScores = {
      90: 1.645,
      95: 1.96,
      99: 2.576,
      99.9: 3.291
    };
    
    // Return exact match if available
    if (zScores[confidenceLevel]) {
      return zScores[confidenceLevel];
    }
    
    // For other confidence levels, use approximation
    if (confidenceLevel >= 99.9) return 3.291;
    if (confidenceLevel >= 99) return 2.576;
    if (confidenceLevel >= 95) return 1.96;
    if (confidenceLevel >= 90) return 1.645;
    if (confidenceLevel >= 80) return 1.282;
    return 1.645; // Default to 90% for lower confidence levels
  }

  async measureFunction(name, fn, minSamples = 200, minTime = 10000) {
    const samples = [];
    const warmupSamples = 20; // Warmup runs to eliminate JIT compilation effects
    
    // Warmup phase - don't record these samples
    console.log(`  Warming up ${name}...`);
    for (let i = 0; i < warmupSamples; i++) {
      await fn();
    }
    
    console.log(`  Measuring ${name}...`);
    const startTime = Date.now();

    // Run at least minSamples times or until minTime milliseconds have passed
    while (samples.length < minSamples || (Date.now() - startTime) < minTime) {
      const start = process.hrtime.bigint();
      await fn();
      const end = process.hrtime.bigint();
      
      // Convert nanoseconds to milliseconds
      const duration = Number(end - start) / 1e6;
      samples.push(duration);

      // Allow more samples for better statistical confidence
      if (samples.length >= 1000) break;
    }

    // Remove outliers using the IQR method for more stable results
    const sortedSamples = [...samples].sort((a, b) => a - b);
    const q1 = sortedSamples[Math.floor(sortedSamples.length * 0.25)];
    const q3 = sortedSamples[Math.floor(sortedSamples.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const filteredSamples = samples.filter(sample => sample >= lowerBound && sample <= upperBound);
    
    // Use filtered samples for calculations if we have enough, otherwise use all samples
    const usedSamples = filteredSamples.length >= Math.min(50, samples.length * 0.8) ? filteredSamples : samples;
    
    // Calculate statistics
    const mean = usedSamples.reduce((sum, time) => sum + time, 0) / usedSamples.length;
    const variance = usedSamples.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / usedSamples.length;
    const standardDeviation = Math.sqrt(variance);
    const standardError = standardDeviation / Math.sqrt(usedSamples.length);
    
    // Get z-score for the specified confidence level
    const zScore = this.getZScore(this.confidenceLevel);
    
    // Relative margin of error as percentage using specified confidence level
    const rme = (standardError / mean) * 100 * zScore;
    
    // Min and max times from used samples
    const min = Math.min(...usedSamples);
    const max = Math.max(...usedSamples);

    return {
      name,
      mean,
      rme,
      samples: usedSamples.length,
      min,
      max,
      variance,
      confidenceLevel: this.confidenceLevel,
    };
  }

  async run() {
    console.log(`\n=== ${this.name} ===`);
    this.results = [];

    for (const benchmark of this.benchmarks) {
      const result = await this.measureFunction(benchmark.name, benchmark.fn);
      this.results.push(result);
      
      // Format output to show timing with specified confidence level
      const meanTime = result.mean.toFixed(3);
      const marginOfError = result.rme.toFixed(2);
      console.log(`${result.name}: ${meanTime}ms ±${marginOfError}% (${result.samples} runs sampled, ${result.confidenceLevel}% confidence)`);
    }

    // Find fastest and slowest (by mean time - lower is faster)
    let fastest = this.results[0];
    let slowest = this.results[0];
    
    for (const result of this.results) {
      if (result.mean < fastest.mean) fastest = result;
      if (result.mean > slowest.mean) slowest = result;
    }

    const benchmarkResult = {
      suiteName: this.name,
      results: this.results,
      benchmarks: this.results, // Alias for backward compatibility
      timestamp: Date.now(),
      fastest: [fastest.name],
      slowest: [slowest.name],
    };

    console.log(`Fastest is ${fastest.name}`);
    return benchmarkResult;
  }
}

// Load queries
const queries = {};
const queryStrings = {};
const queriesDir = path.join(__dirname, "queries");

Object.entries(finalConfig.queries).forEach(([key, filename]) => {
  const queryPath = path.join(queriesDir, filename);
  const queryString = fs.readFileSync(queryPath, "utf-8");
  queryStrings[key] = queryString;
  queries[key] = gql(queryString);
});

// Create ForestRun cache instance
function createCache() {
  return new ForestRun({ 
    maxOperationCount: finalConfig.maxOperationCount,
    resultCacheMaxSize: 0 
  });
}

// Generate test data for a query
function createTestData(queryKey, iteration) {
  const queryString = queryStrings[queryKey];
  const { variables, result } = generateQueryMockData(queryString, {}, {
    seed: iteration,
    arrayLength: 3,
  });
  return { variables, result };
}

// Benchmark write operations
async function benchmarkWrites(queryKey) {
  const suite = new NiceBenchmark(`${queryKey} - Write Operations`, { 
    confidenceLevel: finalConfig.confidenceLevel 
  });
  
  suite.add("ForestRun Write", async () => {
    const cache = createCache();
    const query = queries[queryKey];
    
    for (let i = 0; i < finalConfig.operationsPerIteration; i++) {
      const { variables, result } = createTestData(queryKey, i);
      cache.writeQuery({ query, variables, data: result });
    }
  });
  
  return suite.run();
}

// Benchmark read operations
async function benchmarkReads(queryKey) {
  const suite = new NiceBenchmark(`${queryKey} - Read Operations`, { 
    confidenceLevel: finalConfig.confidenceLevel 
  });
  
  // Pre-populate cache
  const cache = createCache();
  const query = queries[queryKey];
  
  const testData = Array.from({ length: finalConfig.operationsPerIteration }, (_, i) => 
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

// Benchmark cache hit scenarios
async function benchmarkCacheHit(queryKey) {
  const suite = new NiceBenchmark(`${queryKey} - Cache Hit Operations`, { 
    confidenceLevel: finalConfig.confidenceLevel 
  });
  
  suite.add("ForestRun Cache Hit", async () => {
    const cache = createCache();
    const query = queries[queryKey];
    
    // Populate cache with data we'll query
    const testData = Array.from({ length: finalConfig.operationsPerIteration }, (_, i) => 
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

// Main benchmark runner (simplified version with just write, read, and cache hit)
async function runBenchmarks() {
  console.log("🚀 ForestRun Performance Benchmarks");
  console.log(`Configuration: ${JSON.stringify(finalConfig, null, 2)}\n`);
  
  if (cliArgs.confidenceLevel && cliArgs.confidenceLevel !== config.confidenceLevel) {
    console.log(`📊 Confidence level overridden: ${config.confidenceLevel}% → ${cliArgs.confidenceLevel}%\n`);
  }
  
  const results = [];
  const queryKeys = Object.keys(finalConfig.queries);
  
  // Just test one query for demonstration
  const testQueryKey = queryKeys[0];
  console.log(`\n📊 Benchmarking: ${testQueryKey} (demonstration)`);
  
  const writeResults = await benchmarkWrites(testQueryKey);
  console.log(`  Write: ${writeResults.fastest[0]} - ${writeResults.benchmarks[0].mean.toFixed(3)}ms`);
  
  const readResults = await benchmarkReads(testQueryKey);
  console.log(`  Read:  ${readResults.fastest[0]} - ${readResults.benchmarks[0].mean.toFixed(3)}ms`);

  const cacheHitResults = await benchmarkCacheHit(testQueryKey);
  console.log(`  Cache Hit: ${cacheHitResults.fastest[0]} - ${cacheHitResults.benchmarks[0].mean.toFixed(3)}ms`);
  
  results.push({
    queryName: testQueryKey,
    operations: {
      write: writeResults,
      read: readResults,
      cacheHit: cacheHitResults,
    },
  });
  
  const report = {
    timestamp: Date.now(),
    config: finalConfig,
    results,
  };
  
  // Print summary
  console.log("\n📈 Performance Summary");
  console.log("====================");
  results.forEach(({ queryName, operations }) => {
    console.log(`${queryName}:`);
    console.log(`  Write: ${operations.write.benchmarks[0].mean.toFixed(3)}ms`);
    console.log(`  Read:  ${operations.read.benchmarks[0].mean.toFixed(3)}ms`);
    console.log(`  Cache Hit: ${operations.cacheHit.benchmarks[0].mean.toFixed(3)}ms`);
  });
  
  // Save report
  const reportPath = path.join(__dirname, `benchmark-report-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n💾 Report saved to: ${reportPath}`);
  
  return report;
}

// CLI interface
if (require.main === module) {
  // Show help if requested
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
🚀 ForestRun Performance Benchmarks

Usage: node index-with-confidence.js [options]

Options:
  --confidence, -c <level>  Set confidence level (e.g., 90, 95, 99)
                           Default: ${config.confidenceLevel}%
  --help, -h               Show this help message

Examples:
  node index-with-confidence.js                      # Use default ${config.confidenceLevel}% confidence
  node index-with-confidence.js --confidence 99     # Use 99% confidence level
  node index-with-confidence.js -c 90               # Use 90% confidence level

Configuration can also be set in config.json
    `);
    process.exit(0);
  }
  
  runBenchmarks().catch(console.error);
}

module.exports = { runBenchmarks };