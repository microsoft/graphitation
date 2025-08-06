import { parentPort, workerData } from "worker_threads";
import * as fs from "fs";
import * as path from "path";
import { gql } from "@apollo/client";
import { ForestRun } from "../../src/ForestRun";
import NiceBenchmark, { BenchmarkSuiteResult } from "./nice-benchmark";
import { generate } from "@graphitation/graphql-js-operation-payload-generator";
import { buildSchema } from "graphql";

interface BenchmarkTask {
  queryKey: string;
  queryString: string;
  operation: string;
  config: {
    iterations: number;
    operationsPerIteration: number;
    confidenceLevel: number;
  };
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

// Create ForestRun cache instance with fixed settings
function createCache() {
  return new ForestRun({ 
    maxOperationCount: 100,
    resultCacheMaxSize: 0 
  });
}

// Generate test data for a query using graphql-js-operation-payload-generator
function createTestData(queryString: string, iteration: number) {
  const query = gql(queryString);
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

async function executeBenchmark(task: BenchmarkTask): Promise<BenchmarkSuiteResult> {
  const { queryKey, queryString, operation, config } = task;
  const query = gql(queryString);

  switch (operation) {
    case 'write': {
      const suite = new NiceBenchmark(`${queryKey} - Write Operations`, config.confidenceLevel);
      suite.add("ForestRun Write", async () => {
        const cache = createCache();
        for (let i = 0; i < config.operationsPerIteration; i++) {
          const { variables, result } = createTestData(queryString, i);
          cache.writeQuery({ query, variables, data: result });
        }
      });
      return suite.run();
    }

    case 'read': {
      const suite = new NiceBenchmark(`${queryKey} - Read Operations`, config.confidenceLevel);
      const cache = createCache();
      const testData = Array.from({ length: config.operationsPerIteration }, (_, i) => 
        createTestData(queryString, i)
      );
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

    case 'update': {
      const suite = new NiceBenchmark(`${queryKey} - Update Operations`, config.confidenceLevel);
      suite.add("ForestRun Update", async () => {
        const cache = createCache();
        for (let i = 0; i < config.operationsPerIteration; i++) {
          const { variables, result } = createTestData(queryString, i);
          cache.writeQuery({ query, variables, data: result });
        }
        for (let i = 0; i < config.operationsPerIteration; i++) {
          const { variables, result } = createTestData(queryString, i + 1000);
          cache.writeQuery({ query, variables, data: result });
        }
      });
      return suite.run();
    }

    case 'emptyRead': {
      const suite = new NiceBenchmark(`${queryKey} - Empty Cache Reads (Cache Miss)`, config.confidenceLevel);
      suite.add("ForestRun Empty Read", async () => {
        const cache = createCache();
        for (let i = 0; i < config.operationsPerIteration; i++) {
          const { variables } = createTestData(queryString, i);
          try {
            cache.readQuery({ query, variables });
          } catch (e) {
            // Expected - cache miss
          }
        }
      });
      return suite.run();
    }

    case 'cacheMiss': {
      const suite = new NiceBenchmark(`${queryKey} - Cache Miss Operations`, config.confidenceLevel);
      suite.add("ForestRun Cache Miss", async () => {
        const cache = createCache();
        for (let i = 0; i < 50; i++) {
          const { variables, result } = createTestData(queryString, i);
          cache.writeQuery({ query, variables, data: result });
        }
        for (let i = 1000; i < 1000 + config.operationsPerIteration; i++) {
          const { variables } = createTestData(queryString, i);
          try {
            cache.readQuery({ query, variables });
          } catch (e) {
            // Expected - cache miss
          }
        }
      });
      return suite.run();
    }

    case 'cacheHit': {
      const suite = new NiceBenchmark(`${queryKey} - Cache Hit Operations`, config.confidenceLevel);
      suite.add("ForestRun Cache Hit", async () => {
        const cache = createCache();
        const testData = Array.from({ length: config.operationsPerIteration }, (_, i) => 
          createTestData(queryString, i)
        );
        testData.forEach(({ variables, result }) => {
          cache.writeQuery({ query, variables, data: result });
        });
        testData.forEach(({ variables }) => {
          cache.readQuery({ query, variables });
        });
      });
      return suite.run();
    }

    case 'multipleObservers': {
      const suite = new NiceBenchmark(`${queryKey} - Multiple Observers`, config.confidenceLevel);
      suite.add("ForestRun Multiple Observers", async () => {
        const cache = createCache();
        const observerCount = 5;
        const { variables, result } = createTestData(queryString, 0);
        cache.writeQuery({ query, variables, data: result });
        for (let i = 0; i < config.operationsPerIteration; i++) {
          for (let observer = 0; observer < observerCount; observer++) {
            cache.readQuery({ query, variables });
          }
        }
      });
      return suite.run();
    }

    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

// Worker message handler
if (parentPort) {
  parentPort.on('message', async (task: BenchmarkTask) => {
    try {
      const result = await executeBenchmark(task);
      parentPort!.postMessage(result);
    } catch (error) {
      parentPort!.postMessage({ error: error.message });
    }
  });
}