# ForestRun Performance Benchmarks

This directory contains performance benchmarks for the ForestRun cache to measure and analyze its performance characteristics.

## Overview

The benchmark system measures three types of cache operations:
- **Write Operations**: Writing data to the cache
- **Read Operations**: Reading data from the cache  
- **Update Operations**: Updating existing cache data

Each operation is tested against different query complexities to understand ForestRun's performance characteristics.

## Configuration

The benchmark behavior is controlled by `config.json`:

```json
{
  "iterations": 5,                 // Number of benchmark iterations
  "operationsPerIteration": 1000,  // Cache operations per test iteration
  "maxOperationCount": 100,        // Max operations for ForestRun cache
  "queries": {                     // Queries to test
    "simple": "simple-query.graphql",
    "user-profile": "user-profile.graphql", 
    "posts-list": "posts-list.graphql",
    "fragment-query": "fragment-query.graphql",
    "deep-nesting": "deep-nesting.graphql",
    "product": "product-query.graphql"
  }
}
```

## Test Suites

The `queries/` directory contains GraphQL queries of varying complexity:

- **simple-query.graphql**: Basic node query with ID and typename
- **user-profile.graphql**: User profile with posts and personal information
- **posts-list.graphql**: Paginated posts list with comments and authors
- **fragment-query.graphql**: Query using GraphQL fragments
- **deep-nesting.graphql**: Organization with deeply nested departments, teams, and projects
- **product-query.graphql**: Product query with reviews and pricing information

### Adding New Queries

The benchmark system uses **smart mock data generation** that automatically analyzes GraphQL query structure and generates appropriate test data:

1. **Add a GraphQL file**: Create a new `.graphql` file in the `queries/` directory
2. **Update config**: Add the query to the `queries` section in `config.json`
3. **Run benchmark**: The system automatically generates mock data that matches your query structure

**Example**: To add a new query:

```graphql
# queries/my-query.graphql
query MyQuery($id: ID!) {
  user(id: $id) {
    id
    name
    email
    posts {
      id
      title
      content
    }
  }
}
```

```json
// config.json - just add the query reference
{
  "queries": {
    "simple": "simple-query.graphql",
    "my-query": "my-query.graphql"  // No manual data generation needed!
  }
}
```

The system automatically generates appropriate mock data that matches the query structure and field semantics.

## Running Benchmarks

### Local Development

```bash
# Run benchmarks
yarn benchmark

# Run memory benchmarks (existing)
yarn benchmark:memory
```

### GitHub Actions

The benchmark automatically runs when ForestRun code changes:
- **Main branch**: Uploads results as artifacts
- **Pull requests**: Compares with main branch baseline

## Output

The benchmark generates:
1. **Console output**: Real-time results with operations per second
2. **JSON report**: Detailed results saved to `benchmark-report-{timestamp}.json`
3. **Performance summary**: Operations per second for each query type

Example output:
```
📈 Performance Summary
====================
simple:
  Write: 15234.45 ops/sec
  Read:  23451.67 ops/sec
  Update: 12456.78 ops/sec
user-profile:
  Write: 8965.32 ops/sec
  Read:  14532.89 ops/sec
  Update: 7845.23 ops/sec
```

## Understanding Results

- **Higher ops/sec = better performance**
- **Lower RME (Relative Margin of Error) = more consistent results**
- **More samples = higher confidence in results**

Generally:
- Simple queries achieve highest operations per second
- Complex nested queries show ForestRun's optimization benefits
- Read performance often outperforms write performance due to cache structure

## Architecture

The benchmark system is designed to be:
- **Clean and focused**: Only measures ForestRun performance
- **Easy to extend**: Just add GraphQL queries to add new test scenarios
- **Realistic**: Uses smart mock data generation for representative testing
- **Reliable**: Statistical sampling with confidence intervals