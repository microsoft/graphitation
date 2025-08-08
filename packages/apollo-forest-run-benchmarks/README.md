# Apollo ForestRun Benchmarks

A comprehensive benchmarking suite for evaluating Apollo ForestRun cache performance with statistical confidence.

## Features

- **Confidence-Driven Measurement**: Configure target confidence percentage instead of raw error tolerances
- **Automatic Outlier Filtering**: IQR-based outlier removal for stable, reliable results
- **Reliability Testing**: Multi-run stability verification to ensure consistent performance
- **Auto-Discovery**: Automatically finds GraphQL queries and response fixtures
- **Modular Architecture**: Clean separation of concerns across measurement, aggregation, and reporting

## Quick Start

```bash
# Run benchmarks with default settings (99% confidence target)
yarn benchmark

# Compare benchmark reports
yarn benchmark:compare --baseline report1.json --current report2.json
```

## Configuration

Key settings in `src/config.ts`:

- `targetConfidencePercent`: Statistical confidence level (99 = stop when confidence ≥ 99%)
- `observerCounts`: Number of cache observers to test [0, 50, 100]
- `reliability.thresholdPercent`: Variation threshold for stability (1%)
- `maxSamplesPerBenchmark`: Sample limit per test (2000)

## Architecture

- **Stats Class**: Centralized statistical calculations with IQR outlier filtering
- **Adaptive Sampling**: Continues until target confidence is reached or sample limit hit
- **Multi-Run Reliability**: Aggregates across multiple runs for stable results
- **Clean Aggregation**: Merges raw samples and recomputes statistics accurately

## Results

Each benchmark provides:

- Mean execution time (ms)
- Relative margin of error (%)
- Statistical confidence (%)
- Effective sample count (post-filtering)
- Raw filtered samples for further analysis

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
