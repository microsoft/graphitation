import * as fs from "fs";
import * as path from "path";
import { gql, InMemoryCache } from "@apollo/client";
import { ForestRun } from "../../src/ForestRun";
import NiceBenchmark, { BenchmarkSuiteResult } from "./nice-benchmark";

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

// Load queries
const queries: Record<string, any> = {};
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
function generateRandomString(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function createTestData(queryKey: string, iteration: number) {
  const baseId = `${queryKey}_${iteration}_${generateRandomString(8)}`;
  
  switch (queryKey) {
    case "simple":
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
    
    case "complex":
      return {
        variables: { 
          id: baseId, 
          filter: "recent", 
          first: 10 
        },
        result: {
          __typename: "Query",
          node: {
            __typename: "User",
            id: baseId,
            name: `User ${iteration}`,
            email: `user${iteration}@example.com`,
            profile: {
              __typename: "Profile",
              avatar: `avatar_${iteration}.jpg`,
              bio: `Bio for user ${iteration}`,
              lastSeen: new Date().toISOString(),
            },
            posts: {
              __typename: "PostConnection",
              edges: Array.from({ length: 3 }, (_, i) => ({
                __typename: "PostEdge",
                node: {
                  __typename: "Post",
                  id: `post_${baseId}_${i}`,
                  title: `Post ${i} by User ${iteration}`,
                  content: `Content for post ${i}`,
                  createdAt: new Date().toISOString(),
                  author: {
                    __typename: "User",
                    id: baseId,
                    name: `User ${iteration}`,
                  },
                  comments: Array.from({ length: 2 }, (_, j) => ({
                    __typename: "Comment",
                    id: `comment_${baseId}_${i}_${j}`,
                    text: `Comment ${j} on post ${i}`,
                    author: {
                      __typename: "User",
                      id: `commenter_${baseId}_${j}`,
                      name: `Commenter ${j}`,
                    },
                  })),
                },
              })),
            },
          },
        },
      };
    
    case "nested":
      return {
        variables: { id: baseId },
        result: {
          __typename: "Query",
          node: {
            __typename: "Organization",
            id: baseId,
            name: `Organization ${iteration}`,
            description: `Description for org ${iteration}`,
            teams: Array.from({ length: 2 }, (_, teamIdx) => ({
              __typename: "Team",
              id: `team_${baseId}_${teamIdx}`,
              name: `Team ${teamIdx}`,
              members: Array.from({ length: 3 }, (_, memberIdx) => ({
                __typename: "TeamMember",
                id: `member_${baseId}_${teamIdx}_${memberIdx}`,
                name: `Member ${memberIdx}`,
                role: "Developer",
                user: {
                  __typename: "User",
                  id: `user_${baseId}_${teamIdx}_${memberIdx}`,
                  email: `member${memberIdx}@team${teamIdx}.com`,
                  profile: {
                    __typename: "Profile",
                    avatar: `member_${memberIdx}.jpg`,
                    bio: `Member ${memberIdx} bio`,
                  },
                  permissions: Array.from({ length: 2 }, (_, permIdx) => ({
                    __typename: "Permission",
                    id: `perm_${baseId}_${teamIdx}_${memberIdx}_${permIdx}`,
                    name: `permission_${permIdx}`,
                    scope: "read",
                    resource: {
                      __typename: "Resource",
                      id: `resource_${baseId}_${permIdx}`,
                      type: "project",
                      name: `Resource ${permIdx}`,
                    },
                  })),
                },
              })),
              projects: Array.from({ length: 2 }, (_, projIdx) => ({
                __typename: "Project",
                id: `project_${baseId}_${teamIdx}_${projIdx}`,
                name: `Project ${projIdx}`,
                status: "active",
                tasks: Array.from({ length: 3 }, (_, taskIdx) => ({
                  __typename: "Task",
                  id: `task_${baseId}_${teamIdx}_${projIdx}_${taskIdx}`,
                  title: `Task ${taskIdx}`,
                  status: "todo",
                  assignee: {
                    __typename: "User",
                    id: `user_${baseId}_${teamIdx}_0`,
                    name: "Member 0",
                  },
                  dependencies: Array.from({ length: 1 }, (_, depIdx) => ({
                    __typename: "Task",
                    id: `dep_${baseId}_${teamIdx}_${projIdx}_${taskIdx}_${depIdx}`,
                    title: `Dependency ${depIdx}`,
                    status: "done",
                  })),
                })),
              })),
            })),
          },
        },
      };
    
    default:
      throw new Error(`Unknown query key: ${queryKey}`);
  }
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