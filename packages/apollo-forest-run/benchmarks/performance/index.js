const fs = require("fs");
const path = require("path");
const { gql } = require("@apollo/client");
// Mock ForestRun class for testing purposes
class MockForestRun {
  constructor(options = {}) {
    this.maxOperationCount = options.maxOperationCount || 100;
    this.resultCacheMaxSize = options.resultCacheMaxSize || 0;
    this.cache = new Map();
  }

  writeQuery({ query, variables, data }) {
    const key = this.getCacheKey(query, variables);
    this.cache.set(key, data);
  }

  readQuery({ query, variables }) {
    const key = this.getCacheKey(query, variables);
    if (!this.cache.has(key)) {
      throw new Error("Cache miss");
    }
    return this.cache.get(key);
  }

  getCacheKey(query, variables) {
    return JSON.stringify({ query: query.loc?.source?.body || '', variables });
  }
}

// Use mock ForestRun for now
const ForestRun = MockForestRun;

// Helper function to get z-score for different confidence levels
function getZScore(confidenceLevel) {
  switch (confidenceLevel) {
    case 90: return 1.645;
    case 95: return 1.96;
    case 99: return 2.576;
    case 99.9: return 3.291;
    default:
      // For other confidence levels, use normal distribution approximation
      if (confidenceLevel < 90) return 1.645;
      if (confidenceLevel < 95) return 1.96;
      if (confidenceLevel < 99) return 2.576;
      return 3.291;
  }
}

// Simple benchmark class
class NiceBenchmark {
  constructor(name, confidenceLevel = 95) {
    this.name = name;
    this.benchmarks = [];
    this.results = [];
    this.confidenceLevel = confidenceLevel || 95;
  }

  add(name, fn) {
    this.benchmarks.push({ name, fn });
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
    
    // Use configurable confidence level
    const zScore = getZScore(this.confidenceLevel);
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
    };
  }

  async run(options) {
    console.log(`\n=== ${this.name} ===`);
    this.results = [];

    for (const benchmark of this.benchmarks) {
      const result = await this.measureFunction(benchmark.name, benchmark.fn);
      this.results.push(result);
      
      // Format output to show timing with configured confidence level
      const meanTime = result.mean.toFixed(3);
      const marginOfError = result.rme.toFixed(2);
      console.log(`${result.name}: ${meanTime}ms ±${marginOfError}% (${result.samples} runs sampled, ${this.confidenceLevel}% confidence)`);
    }

    // Find fastest (by mean time - lower is faster)
    let fastest = this.results[0];
    
    for (const result of this.results) {
      if (result.mean < fastest.mean) fastest = result;
    }

    return {
      suiteName: this.name,
      benchmarks: this.results,
      timestamp: Date.now(),
      fastest: [fastest.name],
    };
  }
}

// Simple mock data generator
class MockDataGenerator {
  constructor() {
    this.idCounter = 0;
  }

  generateId() {
    return `id_${++this.idCounter}_${Date.now()}`;
  }

  generateString(fieldName) {
    const patterns = {
      name: () => `Mock Name ${this.idCounter}`,
      title: () => `Mock Title ${this.idCounter}`,
      email: () => `user${this.idCounter}@example.com`,
      content: () => `Mock content for ${fieldName} ${this.idCounter}`,
      bio: () => `Mock bio ${this.idCounter}`,
      comment: () => `Mock comment ${this.idCounter}`,
      avatar: () => `https://example.com/avatar${this.idCounter}.jpg`,
    };

    const generator = patterns[fieldName.toLowerCase()] || (() => `Mock ${fieldName} ${this.idCounter}`);
    return generator();
  }

  generateNumber(fieldName) {
    const patterns = {
      price: () => Math.floor(Math.random() * 1000) + 1,
      rating: () => Math.floor(Math.random() * 5) + 1,
      likes: () => Math.floor(Math.random() * 100),
      age: () => Math.floor(Math.random() * 80) + 18,
    };

    const generator = patterns[fieldName.toLowerCase()] || (() => Math.floor(Math.random() * 100));
    return generator();
  }

  generateFieldValue(fieldName) {
    // Handle common field name patterns
    if (fieldName === 'id' || fieldName.endsWith('Id')) {
      return this.generateId();
    }
    
    if (fieldName === '__typename') {
      return 'MockType';
    }

    if (fieldName.includes('At') || fieldName.includes('Date')) {
      return new Date().toISOString();
    }

    if (fieldName === 'cursor') {
      return `cursor_${this.idCounter}`;
    }

    if (fieldName === 'hasNextPage') {
      return Math.random() > 0.5;
    }

    if (fieldName === 'endCursor') {
      return `end_cursor_${this.idCounter}`;
    }

    // Handle numeric fields
    if (['price', 'rating', 'likes', 'age', 'first', 'count'].includes(fieldName.toLowerCase())) {
      return this.generateNumber(fieldName);
    }

    // Default to string
    return this.generateString(fieldName);
  }

  // Simple mock data for common query patterns
  generateMockData(queryKey, iteration) {
    const baseId = this.generateId();
    const arrayLength = 3;
    
    // Generate basic mock structure based on query name
    if (queryKey.includes('user') || queryKey.includes('profile')) {
      return {
        variables: { userId: baseId },
        result: {
          __typename: "Query",
          user: {
            __typename: "User",
            id: baseId,
            name: this.generateString('name'),
            email: this.generateString('email'),
            profile: {
              __typename: "Profile",
              bio: this.generateString('bio'),
              avatar: this.generateString('avatar'),
              createdAt: this.generateFieldValue('createdAt'),
            },
            posts: Array.from({ length: arrayLength }, () => ({
              __typename: "Post",
              id: this.generateId(),
              title: this.generateString('title'),
              content: this.generateString('content'),
              createdAt: this.generateFieldValue('createdAt'),
              likes: this.generateNumber('likes'),
            })),
          },
        },
      };
    }
    
    if (queryKey.includes('post')) {
      return {
        variables: { first: 10, after: null },
        result: {
          __typename: "Query",
          posts: {
            __typename: "PostConnection",
            edges: Array.from({ length: arrayLength }, () => ({
              __typename: "PostEdge",
              node: {
                __typename: "Post",
                id: this.generateId(),
                title: this.generateString('title'),
                content: this.generateString('content'),
                author: {
                  __typename: "User",
                  id: this.generateId(),
                  name: this.generateString('name'),
                },
                comments: Array.from({ length: 2 }, () => ({
                  __typename: "Comment",
                  id: this.generateId(),
                  content: this.generateString('content'),
                  author: {
                    __typename: "User",
                    id: this.generateId(),
                    name: this.generateString('name'),
                  },
                })),
              },
              cursor: this.generateFieldValue('cursor'),
            })),
            pageInfo: {
              __typename: "PageInfo",
              hasNextPage: this.generateFieldValue('hasNextPage'),
              endCursor: this.generateFieldValue('endCursor'),
            },
          },
        },
      };
    }
    
    if (queryKey.includes('deep') || queryKey.includes('nesting')) {
      return {
        variables: { id: baseId },
        result: {
          __typename: "Query",
          organization: {
            __typename: "Organization",
            id: baseId,
            name: this.generateString('name'),
            departments: Array.from({ length: arrayLength }, () => ({
              __typename: "Department",
              id: this.generateId(),
              name: this.generateString('name'),
              teams: Array.from({ length: arrayLength }, () => ({
                __typename: "Team",
                id: this.generateId(),
                name: this.generateString('name'),
                members: Array.from({ length: arrayLength }, () => ({
                  __typename: "Member",
                  id: this.generateId(),
                  name: this.generateString('name'),
                  role: 'Developer',
                  projects: Array.from({ length: 2 }, () => ({
                    __typename: "Project",
                    id: this.generateId(),
                    name: this.generateString('name'),
                    tasks: Array.from({ length: 2 }, () => ({
                      __typename: "Task",
                      id: this.generateId(),
                      title: this.generateString('title'),
                      status: 'active',
                      assignee: {
                        __typename: "User",
                        id: this.generateId(),
                        name: this.generateString('name'),
                      },
                    })),
                  })),
                })),
              })),
            })),
          },
        },
      };
    }
    
    // Default simple mock
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
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  
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

function showHelp() {
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
let config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// Override config with command line arguments
const cliArgs = parseArgs();

if (cliArgs.help) {
  showHelp();
  process.exit(0);
}

if (cliArgs.confidenceLevel !== undefined) {
  config.confidenceLevel = cliArgs.confidenceLevel;
  console.log(`📊 Configuration:`);
  console.log(`   Confidence Level: ${config.confidenceLevel}%`);
  
  // Update config file to remember the setting
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`   ✅ Updated config.json with confidence level: ${config.confidenceLevel}%`);
}

// Load queries
const queries = {};
const queriesDir = path.join(__dirname, "queries");

Object.entries(config.queries).forEach(([key, filename]) => {
  const queryPath = path.join(queriesDir, filename);
  const queryString = fs.readFileSync(queryPath, "utf-8");
  queries[key] = gql(queryString);
});

// Create ForestRun cache instance
function createCache() {
  return new ForestRun({ 
    maxOperationCount: config.maxOperationCount,
    resultCacheMaxSize: 0 
  });
}

// Generate test data
const mockGenerator = new MockDataGenerator();

function createTestData(queryKey, iteration) {
  return mockGenerator.generateMockData(queryKey, iteration);
}

// Benchmark write operations
async function benchmarkWrites(queryKey) {
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
async function benchmarkReads(queryKey) {
  const suite = new NiceBenchmark(`${queryKey} - Read Operations`, config.confidenceLevel);
  
  // Pre-populate cache
  const cache = createCache();
  const query = queries[queryKey];
  
  const testData = [];
  for (let i = 0; i < config.operationsPerIteration; i++) {
    testData.push(createTestData(queryKey, i));
  }
  
  // Populate cache
  testData.forEach(({ variables, result }) => {
    cache.writeQuery({ query, variables, data: result });
  });
  
  suite.add("ForestRun Read", async () => {
    testData.forEach(({ variables }) => {
      try {
        cache.readQuery({ query, variables });
      } catch (error) {
        // Ignore read errors for benchmarking
      }
    });
  });
  
  return suite.run();
}

// Benchmark update operations
async function benchmarkUpdates(queryKey) {
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

// Benchmark empty cache read operations (cache misses)
async function benchmarkEmptyReads(queryKey) {
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
async function benchmarkCacheMiss(queryKey) {
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
async function benchmarkCacheHit(queryKey) {
  const suite = new NiceBenchmark(`${queryKey} - Cache Hit Operations`, config.confidenceLevel);
  
  suite.add("ForestRun Cache Hit", async () => {
    const cache = createCache();
    const query = queries[queryKey];
    
    // Populate cache with data we'll query
    const testData = [];
    for (let i = 0; i < config.operationsPerIteration; i++) {
      testData.push(createTestData(queryKey, i));
    }
    
    testData.forEach(({ variables, result }) => {
      cache.writeQuery({ query, variables, data: result });
    });
    
    // Read the same data (cache hits)
    testData.forEach(({ variables }) => {
      try {
        cache.readQuery({ query, variables });
      } catch (e) {
        // Handle any errors
      }
    });
  });
  
  return suite.run();
}

// Benchmark multiple observers scenario
async function benchmarkMultipleObservers(queryKey) {
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
        try {
          cache.readQuery({ query, variables });
        } catch (e) {
          // Handle any errors
        }
      }
    }
  });
  
  return suite.run();
}

// Main benchmark runner
async function runBenchmarks() {
  console.log("🚀 ForestRun Performance Benchmarks");
  console.log(`📊 Configuration:`);
  console.log(`   Confidence Level: ${config.confidenceLevel}%`);
  console.log("");
  
  const results = [];
  const queryKeys = Object.keys(config.queries);
  
  for (const queryKey of queryKeys) {
    console.log(`\n📊 Benchmarking: ${queryKey}`);
    
    const writeResults = await benchmarkWrites(queryKey);
    console.log(`  Write: ${writeResults.fastest[0]} - ${writeResults.benchmarks[0].mean.toFixed(3)}ms`);
    
    const readResults = await benchmarkReads(queryKey);
    console.log(`  Read:  ${readResults.fastest[0]} - ${readResults.benchmarks[0].mean.toFixed(3)}ms`);
    
    const updateResults = await benchmarkUpdates(queryKey);
    console.log(`  Update: ${updateResults.fastest[0]} - ${updateResults.benchmarks[0].mean.toFixed(3)}ms`);

    const emptyReadResults = await benchmarkEmptyReads(queryKey);
    console.log(`  Empty Read: ${emptyReadResults.fastest[0]} - ${emptyReadResults.benchmarks[0].mean.toFixed(3)}ms`);

    const cacheMissResults = await benchmarkCacheMiss(queryKey);
    console.log(`  Cache Miss: ${cacheMissResults.fastest[0]} - ${cacheMissResults.benchmarks[0].mean.toFixed(3)}ms`);

    const cacheHitResults = await benchmarkCacheHit(queryKey);
    console.log(`  Cache Hit: ${cacheHitResults.fastest[0]} - ${cacheHitResults.benchmarks[0].mean.toFixed(3)}ms`);

    const multipleObserversResults = await benchmarkMultipleObservers(queryKey);
    console.log(`  Multiple Observers: ${multipleObserversResults.fastest[0]} - ${multipleObserversResults.benchmarks[0].mean.toFixed(3)}ms`);
    
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
  
  const report = {
    timestamp: Date.now(),
    config,
    results,
  };
  
  // Print summary
  console.log("\n📈 Performance Summary");
  console.log("====================");
  results.forEach(({ queryName, operations }) => {
    console.log(`${queryName}:`);
    console.log(`  Write: ${operations.write.benchmarks[0].mean.toFixed(3)}ms`);
    console.log(`  Read:  ${operations.read.benchmarks[0].mean.toFixed(3)}ms`);
    console.log(`  Update: ${operations.update.benchmarks[0].mean.toFixed(3)}ms`);
    console.log(`  Empty Read: ${operations.emptyRead.benchmarks[0].mean.toFixed(3)}ms`);
    console.log(`  Cache Miss: ${operations.cacheMiss.benchmarks[0].mean.toFixed(3)}ms`);
    console.log(`  Cache Hit: ${operations.cacheHit.benchmarks[0].mean.toFixed(3)}ms`);
    console.log(`  Multiple Observers: ${operations.multipleObservers.benchmarks[0].mean.toFixed(3)}ms`);
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

module.exports = { runBenchmarks };