# ForestRun Performance Benchmarks

This directory contains performance benchmarks for the ForestRun cache, comparing it against Apollo's InMemoryCache.

## Overview

The benchmark system measures three types of cache operations:
- **Write Operations**: Writing data to the cache
- **Read Operations**: Reading data from the cache  
- **Update Operations**: Updating existing cache data

Each operation is tested against different query complexities to understand performance characteristics.

## Configuration

The benchmark behavior is controlled by `config.json`:

```json
{
  "iterations": 10,               // Number of benchmark iterations
  "warmupIterations": 3,          // Warmup iterations before measurement
  "operationsPerIteration": 1000, // Cache operations per test iteration
  "maxOperationCount": 100,       // Max operations for ForestRun cache
  "confidence": {
    "level": 0.95,               // Statistical confidence level
    "minSamples": 5,             // Minimum samples for confidence
    "maxSamples": 50             // Maximum samples to collect
  },
  "queries": {                   // Queries to test
    "simple": "simple-query.graphql",
    "complex": "complex-query.graphql", 
    "nested": "nested-query.graphql"
  }
}
```

## Queries

The `queries/` directory contains GraphQL queries of varying complexity:

- **simple-query.graphql**: Basic node query with ID and typename
- **complex-query.graphql**: User query with nested posts, comments, and profile data
- **nested-query.graphql**: Organization query with deeply nested teams, members, and projects

### Adding New Queries

The benchmark system uses **dynamic mock data generation** that automatically analyzes GraphQL query structure and generates appropriate test data. This means you can easily add new queries without hardcoding response structures:

1. **Add a GraphQL file**: Create a new `.graphql` file in the `queries/` directory
2. **Update config**: Add the query to the `queries` section in `config.json`
3. **Run benchmark**: The system automatically generates mock data that matches your query structure

**Example**: To add a product query:

```graphql
# queries/product-query.graphql
query ProductQuery($id: ID!) {
  node(id: $id) {
    id
    __typename
    ... on Product {
      name
      price
      category {
        id
        name
      }
      reviews {
        id
        rating
        comment
        author {
          id
          name
        }
      }
    }
  }
}
```

```json
// config.json
{
  "queries": {
    "simple": "simple-query.graphql",
    "complex": "complex-query.graphql", 
    "nested": "nested-query.graphql",
    "product": "product-query.graphql"  // Add your new query
  }
}
```

The mock data generator will automatically:
- Parse the GraphQL query structure
- Generate appropriate field values based on field names and types
- Create realistic test data (products, prices, reviews, etc.)
- Handle arrays, nested objects, and fragments
- Ensure consistent data across test runs

## Running Benchmarks

### Local Development

```bash
# Run benchmarks
yarn benchmark

# Run memory benchmarks (existing)
yarn benchmark:memory
```

### GitHub Actions

The benchmark automatically runs:
- **On main branch**: When ForestRun code changes, uploads results as artifacts
- **On pull requests**: When ForestRun code changes, compares with main branch results

Results are displayed in the PR summary with performance comparisons.

## Output

The benchmark generates:
1. **Console output**: Real-time results with operations per second
2. **JSON report**: Detailed results saved to `benchmark-report-{timestamp}.json`
3. **Summary**: Which cache implementation was faster for each test

Example output:
```
📈 Benchmark Summary
==================
Total benchmark suites: 6
ForestRun faster in: 4 suites
InMemoryCache faster in: 2 suites

🏆 ForestRun was faster in:
  - Read Operations - complex
  - Write Operations - complex  
  - Update Operations - complex
  - Read Operations - nested

🥈 InMemoryCache was faster in:
  - Write Operations - simple
  - Update Operations - simple
```

## Understanding Results

- **Higher ops/sec = better performance**
- **Lower RME (Relative Margin of Error) = more consistent results**
- **More samples = higher confidence in results**

Generally:
- ForestRun tends to perform better with complex, nested queries
- InMemoryCache may be faster for simple operations
- Read performance often favors ForestRun due to its optimized data structure

## Adding New Tests

To add a new query type:

1. **Create GraphQL file**: Add a new `.graphql` file in the `queries/` directory
2. **Update configuration**: Add it to the `queries` section in `config.json`  
3. **Run benchmark**: The dynamic mock data generator automatically handles the new query

**No manual data generation needed!** The system automatically:
- Analyzes your GraphQL query structure
- Generates realistic mock data that matches field names and types
- Handles complex nested structures, arrays, and fragments
- Creates consistent test data for reliable benchmarking

This makes adding new benchmark scenarios as simple as writing a GraphQL query.