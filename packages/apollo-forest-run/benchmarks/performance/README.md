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

You can easily add new queries by:
1. Adding a `.graphql` file to the `queries/` directory
2. Updating the `queries` section in `config.json`
3. Optionally updating the test data generator in `index.js` for custom data structures

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

1. Create a new `.graphql` file in `queries/`
2. Add it to `config.json` queries section
3. Update the `createTestData()` function in `index.js` to generate appropriate test data for your query structure
4. Run the benchmark to see results

The system automatically handles the new query type and generates comparison results.