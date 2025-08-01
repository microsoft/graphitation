const fs = require("fs");
const path = require("path");
const { gql } = require("@apollo/client");
const { ForestRun } = require("../../lib/ForestRun");

// Simple benchmark class
class NiceBenchmark {
  constructor(name) {
    this.name = name;
    this.benchmarks = [];
    this.results = [];
  }

  add(name, fn) {
    this.benchmarks.push({ name, fn });
  }

  async measureFunction(name, fn, minSamples = 5, minTime = 1000) {
    const samples = [];
    const startTime = Date.now();

    // Run at least minSamples times or until minTime milliseconds have passed
    while (samples.length < minSamples || (Date.now() - startTime) < minTime) {
      const start = process.hrtime.bigint();
      await fn();
      const end = process.hrtime.bigint();
      
      // Convert nanoseconds to seconds
      const duration = Number(end - start) / 1e9;
      samples.push(duration);

      // Don't run too many samples to avoid excessive execution time
      if (samples.length >= 100) break;
    }

    // Calculate statistics
    const mean = samples.reduce((sum, time) => sum + time, 0) / samples.length;
    const variance = samples.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / samples.length;
    const standardDeviation = Math.sqrt(variance);
    const standardError = standardDeviation / Math.sqrt(samples.length);
    
    // Relative margin of error as percentage (using 95% confidence interval)
    const rme = (standardError / mean) * 100 * 1.96;
    
    // Operations per second
    const hz = 1 / mean;

    return {
      name,
      hz,
      rme,
      samples: samples.length,
      mean,
      variance,
    };
  }

  async run(options) {
    console.log(`\n=== ${this.name} ===`);
    this.results = [];

    for (const benchmark of this.benchmarks) {
      const result = await this.measureFunction(benchmark.name, benchmark.fn);
      this.results.push(result);
      
      // Format output similar to benchmark.js
      const opsPerSec = result.hz.toLocaleString('en-US', { maximumFractionDigits: 2 });
      const marginOfError = result.rme.toFixed(2);
      console.log(`${result.name} x ${opsPerSec} ops/sec ±${marginOfError}% (${result.samples} runs sampled)`);
    }

    // Find fastest
    let fastest = this.results[0];
    
    for (const result of this.results) {
      if (result.hz > fastest.hz) fastest = result;
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
async function benchmarkReads(queryKey) {
  const suite = new NiceBenchmark(`${queryKey} - Read Operations`);
  
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
async function runBenchmarks() {
  console.log("🚀 ForestRun Performance Benchmarks");
  console.log(`Configuration: ${JSON.stringify(config, null, 2)}\n`);
  
  const results = [];
  const queryKeys = Object.keys(config.queries);
  
  for (const queryKey of queryKeys) {
    console.log(`\n📊 Benchmarking: ${queryKey}`);
    
    const writeResults = await benchmarkWrites(queryKey);
    console.log(`  Write: ${writeResults.fastest[0]} - ${writeResults.benchmarks[0].hz.toFixed(2)} ops/sec`);
    
    const readResults = await benchmarkReads(queryKey);
    console.log(`  Read:  ${readResults.fastest[0]} - ${readResults.benchmarks[0].hz.toFixed(2)} ops/sec`);
    
    const updateResults = await benchmarkUpdates(queryKey);
    console.log(`  Update: ${updateResults.fastest[0]} - ${updateResults.benchmarks[0].hz.toFixed(2)} ops/sec`);
    
    results.push({
      queryName: queryKey,
      operations: {
        write: writeResults,
        read: readResults,
        update: updateResults,
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
    console.log(`  Write: ${operations.write.benchmarks[0].hz.toFixed(2)} ops/sec`);
    console.log(`  Read:  ${operations.read.benchmarks[0].hz.toFixed(2)} ops/sec`);
    console.log(`  Update: ${operations.update.benchmarks[0].hz.toFixed(2)} ops/sec`);
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