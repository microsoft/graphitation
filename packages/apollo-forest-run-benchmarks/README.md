# ForestRun Benchmarks

A comprehensive performance benchmark suite for the ForestRun GraphQL cache implementation.

## Features

- **Lean Statistical Confidence Calculation**: Uses margin-of-error based approach with configurable confidence levels
- **Simplified Parallel Execution**: Distributes benchmark tasks across CPU cores for faster execution  
- **Comprehensive Cache Scenarios**: Tests write, read, update, cache miss, cache hit, and multiple observer patterns
- **Diverse GraphQL Query Patterns**: 9 different query types from simple to complex nested structures
- **Automatic Mock Data Generation**: Uses @graphitation/graphql-js-operation-payload-generator
- **Standalone Comparison Tool**: Compare benchmark results with multiple output formats

## Usage

### Running Benchmarks

```bash
# Use default 95% confidence
yarn benchmark

# High precision (99% confidence) 
yarn benchmark --confidence 99

# Faster benchmarks (90% confidence)
yarn benchmark -c 90

# Show help
yarn benchmark --help
```

### Comparing Results

```bash
# Auto-detect latest two reports
yarn benchmark:compare

# Compare specific files
yarn benchmark:compare -b baseline.json -c current.json

# Generate markdown for GitHub
yarn benchmark:compare -f markdown

# JSON output for programmatic use
yarn benchmark:compare -f json

# Show comparison help
yarn benchmark:compare --help
```

## Configuration

Edit `src/config.json` to modify:

- `confidenceLevel`: Target statistical confidence (0-100)
- `operationsPerIteration`: Number of operations per benchmark iteration
- `queries`: Map of query names to GraphQL files

## Statistical Method

- **Confidence Calculation**: `confidence = 100 - (moe / amean) * 100`
- **Adaptive Sampling**: Runs 50-sample batches until target confidence achieved
- **Outlier Filtering**: IQR-based filtering for robust measurements
- **Maximum Samples**: 1000 samples per test to prevent infinite loops

## Cache Scenarios Tested

1. **Write Operations**: Basic cache write performance
2. **Read Operations**: Cache read from populated cache
3. **Update Operations**: Cache update/overwrite performance
4. **Empty Cache Reads**: Performance on empty cache (miss scenario)
5. **Cache Miss Operations**: Querying populated cache with different data
6. **Cache Hit Operations**: Querying exact cached data
7. **Multiple Observers**: Multiple observers reading same cached data

## Query Patterns

- Simple Query: Basic node lookup
- User Profile: User data with nested posts
- Posts List: Paginated connections with comments
- Fragment Query: GraphQL fragments usage
- Deep Nesting: Complex organizational hierarchy
- Product Query: E-commerce with reviews
- Complex Nested: Advanced organizational structures
- Fragmented Posts: Advanced fragment patterns
- Paginated Blog: Rich blog structure

## Output

Each benchmark result shows:
- Mean execution time in milliseconds
- Relative margin of error percentage  
- Number of samples collected
- Actual confidence level achieved

Example: `1.084ms ±0.73% (30 runs sampled, 99.3% confidence)`