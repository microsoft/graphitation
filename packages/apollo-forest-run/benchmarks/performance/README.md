# ForestRun Performance Benchmarks

This directory contains performance benchmarks for the ForestRun cache to measure and analyze its performance characteristics with **high statistical confidence**.

## Overview

The benchmark system measures seven types of cache operations across various scenarios:
- **Write Operations**: Writing data to the cache
- **Read Operations**: Reading data from pre-populated cache  
- **Update Operations**: Updating existing cache data
- **Empty Cache Reads**: Reading from empty cache (cache miss scenarios)
- **Cache Miss Operations**: Reading different data from populated cache
- **Cache Hit Operations**: Reading exact cached data matches
- **Multiple Observers**: Performance when multiple observers read the same cached data

Each operation is tested against different query complexities with **configurable statistical confidence** (typically <5% margin of error).

## ⚡ High-Confidence Statistical Measurements

The benchmark system is designed for **maximum statistical reliability**:

### 🎯 Precision Features
- **Minimum 200 samples** per benchmark (vs industry standard 5-10)
- **Minimum 10 seconds** of measurement time per test
- **Warmup phase**: 20 runs before measurement to eliminate JIT effects
- **Outlier filtering**: IQR-based outlier removal for stable results
- **Up to 1000 samples** for complex scenarios requiring high precision

### 📊 Configurable Statistical Accuracy
- **Configurable confidence levels**: Set via command line or config file
- **Appropriate z-scores**: Automatically calculated for your confidence level
- **Real-time confidence reporting**: Shows actual confidence levels achieved
- **Millisecond precision timing**: Using `process.hrtime.bigint()`

**Confidence Level Options:**
- **90% confidence** → z = 1.645 (faster benchmarks, lower precision)
- **95% confidence** → z = 1.96 (default, balanced precision/speed)
- **99% confidence** → z = 2.576 (high precision, longer benchmarks)
- **99.9% confidence** → z = 3.291 (maximum precision, longest benchmarks)

### 📈 Example Output
```
=== user-profile - Write Operations ===
  Warming up ForestRun Write...
  Measuring ForestRun Write...
ForestRun Write: 0.845ms ±2.31% (387 runs sampled, 95% confidence)

=== user-profile - Cache Hit Operations ===  
  Warming up ForestRun Cache Hit...
  Measuring ForestRun Cache Hit...
ForestRun Cache Hit: 0.198ms ±1.84% (456 runs sampled, 95% confidence)
```

## Configuration

The benchmark behavior is controlled by `config.json`:

```json
{
  "iterations": 3,                 // Number of benchmark iterations  
  "operationsPerIteration": 50,    // Cache operations per test iteration
  "maxOperationCount": 100,        // Max operations for ForestRun cache
  "confidenceLevel": 95,           // Statistical confidence level (90, 95, 99, 99.9)
  "queries": {                     // Queries to test
    "simple": "simple-query.graphql",
    "user-profile": "user-profile.graphql", 
    "posts-list": "posts-list.graphql",
    "fragment-query": "fragment-query.graphql",
    "deep-nesting": "deep-nesting.graphql",
    "product": "product-query.graphql",
    "complex-nested": "complex-nested.graphql",
    "fragmented-posts": "fragmented-posts.graphql",
    "paginated-blog": "paginated-blog.graphql"
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
- **complex-nested.graphql**: Advanced organizational structures with multiple nesting levels
- **fragmented-posts.graphql**: Advanced fragment usage with inline fragments
- **paginated-blog.graphql**: Rich blog post structure with metadata and nested comments

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
    orders {
      id
      total
      items {
        name
        price
      }
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
# Run benchmarks with default 95% confidence
yarn benchmark

# Run benchmarks with 99% confidence (higher precision, takes longer)
yarn benchmark --confidence 99

# Run benchmarks with 90% confidence (faster, lower precision)  
yarn benchmark --confidence 90

# Show help with all options
yarn benchmark --help

# Run memory benchmarks (existing)
yarn benchmark:memory
```

### Command Line Options

The benchmark system supports configurable confidence levels:

```bash
# Using yarn (recommended)
yarn benchmark --confidence 99     # 99% confidence level
yarn benchmark -c 90               # 90% confidence level (shorthand)
yarn benchmark --help              # Show help

# Direct script execution
./benchmarks/performance/benchmark-wrapper.sh --confidence 99
./benchmarks/performance/benchmark-wrapper.sh -c 90  
./benchmarks/performance/benchmark-wrapper.sh --help
```

**Confidence Level Trade-offs:**

| Level | Z-Score | Precision | Speed | Use Case |
|-------|---------|-----------|-------|----------|
| 90%   | 1.645   | Good      | Fast  | Quick testing, development |
| 95%   | 1.96    | High      | Medium| Production benchmarks (default) |
| 99%   | 2.576   | Very High | Slow  | Critical performance analysis |
| 99.9% | 3.291   | Maximum   | Slowest | Research, publication-quality results |

### GitHub Actions

The benchmark automatically runs when ForestRun code changes:
- **Main branch**: Uploads results as artifacts
- **Pull requests**: Compares with main branch baseline

## Output

The benchmark generates:
1. **Console output**: Real-time results with **millisecond timing and confidence levels**
2. **JSON report**: Detailed results saved to `benchmark-report-{timestamp}.json`
3. **Performance summary**: Timing in milliseconds for each query type and operation

Example output:
```
📊 Benchmarking: user-profile
=== user-profile - Write Operations ===
  Warming up ForestRun Write...
  Measuring ForestRun Write...
ForestRun Write: 0.906ms ±2.01% (387 runs sampled, 98.0% confidence)

=== user-profile - Cache Hit Operations ===  
  Warming up ForestRun Cache Hit...
  Measuring ForestRun Cache Hit...
ForestRun Cache Hit: 0.198ms ±1.84% (456 runs sampled, 98.2% confidence)

📈 Performance Summary
====================
user-profile:
  Write: 0.906ms
  Read: 0.199ms
  Update: 1.620ms
  Empty Read: 1.193ms
  Cache Miss: 1.684ms
  Cache Hit: 0.198ms
  Multiple Observers: 0.984ms
```

## Understanding Results

- **Lower milliseconds = better performance**
- **Lower margin of error = higher confidence** (target: <5%)
- **Higher confidence percentage = more reliable results** (target: >95%)
- **More samples = better statistical validity**

Generally:
- Cache hit operations are fastest (data already available)
- Empty cache reads and cache misses are slower (require data fetching/generation)
- Simple queries achieve fastest execution times
- Complex nested queries show ForestRun's optimization benefits
- Multiple observers scenario tests concurrency performance

## Architecture

The benchmark system is designed to be:
- **Statistically rigorous**: High-confidence measurements with extensive sampling
- **Clean and focused**: Only measures ForestRun performance with maximum precision
- **Easy to extend**: Just add GraphQL queries to add new test scenarios
- **Realistic**: Uses smart mock data generation for representative testing
- **Reliable**: Warmup phases, outlier filtering, and robust statistical measures