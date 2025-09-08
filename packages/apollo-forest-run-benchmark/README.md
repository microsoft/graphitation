# Apollo Forest Run Benchmark

A benchmarking suite for measuring the performance characteristics of the `@graphitation/apollo-forest-run` GraphQL cache. It helps you:

- Detect performance regressions in a branch vs the latest published npm package
- Evaluate the impact of enabling / changing cache configuration options
- Understand watcher overhead at different subscription counts
- Track both execution latency (nanoseconds per operation) and memory deltas (heap bytes per operation)

## 🎯 Purpose & Metrics

The suite compares two cache "factories":

- `baseline`: Latest npm version (downloaded via `yarn clone`)
- `current`: Your locally built version in this repo

Per benchmark we collect:

- Execution time (ns) per single operation invocation
- Memory delta (bytes) per operation (heapUsed after − before)
- Derived stats: arithmetic mean, samples, relative confidence, throughput (`tasksPerMs`)

## 🚀 Quick Start

Commands:

```bash
# 1. Prepare baseline & current builds
yarn clone

# 2. Run benchmarks (build + execute)
yarn benchmark
```

Artifacts will appear in `results/` as timestamped `benchmark-<ISO>.json` and `benchmark-<ISO>.md`.

Significant changes are those exceeding the configured threshold (default 5%).

## 🔄 Workflow

1. Modify `@graphitation/apollo-forest-run`
2. Rebuild baseline assets: `yarn clone` (this copies your local build to `forest-runs/current` and re-fetches npm latest into `forest-runs/baseline`)
   - To pin a specific baseline version: edit `scripts/clone-caches.sh` and replace `@latest` with `@<version>`
3. Run: `yarn benchmark`
4. Inspect `results/*md` or terminal for significant changes

## 📝 Adding Queries & Scenarios

### New Queries

Create a `.graphql` file in `data/queries/` and a matching `.json` response in `data/responses/` (same base name). They are auto-discovered at startup (`utils/operations.ts`). Variables currently default to `{}`; extend loader if needed.

```
data/
├── queries/
│   └── my-new-query.graphql
└── responses/
    └── my-new-query.json
```

### New Scenarios

Edit `src/scenarios.ts` and add a new object with a `prepare` function returning `{ run() { ... } }`.

Guidelines:

- Do one logical cache operation per `run()` (keep it small / deterministic)
- Initialize watchers via helper if needed to include subscription overhead
- Pre-populate cache inside `prepare` (not inside `run`) unless testing raw write cost

Example skeleton:

```ts
{
  name: "my-scenario",
  prepare: (ctx) => {
    const { CacheFactory, configuration, query, variables, data } = ctx;
    const cache = new CacheFactory(configuration);
    // optional: preload
    cache.writeQuery({ query, variables, data });
    return {
      run() {
        return cache.readQuery({ query, variables });
      },
    };
  },
}
```

## 📊 How to Read Results

Each run produces two timestamped artifacts in `results/`:

- `benchmark-<timestamp>.json` – structured data
- `benchmark-<timestamp>.md` – human summary

The markdown may show two tables:

### Same Configuration Comparisons

Current code vs baseline npm with an identical cache configuration.

```
| Benchmark ID         | Configuration | Execution                             | Memory |
|----------------------|---------------|---------------------------------------|--------|
| simple-query_write_0 | Default       | 🟢 17137.05 ns → 16150.74 ns (-5.8%)  |        |
```

Interpretation: Execution improved 5.8%. Memory change not significant (blank cell).

### Configuration Impact Analysis

Effect of a non-default configuration versus the baseline _default_ configuration.

```
| Benchmark ID              | Configuration     | Execution                          | Memory                                   |
|---------------------------|-------------------|------------------------------------|------------------------------------------|
| fragmented-posts_update_0 | Telemetry enabled | 🔴 4515.50 ns → 6008.76 ns (33.1%) | 🔴 2744.43 bytes → 3096.10 bytes (12.8%) |
```

Interpretation: Telemetry increases execution time and memory usage (regressions).

### Legend

- 🟢 Improvement (lower is better for time & memory)
- 🔴 Regression (exceeds threshold)
- Blank: change below threshold

### Threshold

Relative change ≥ `stabilityThreshold` (default 5%) for either execution mean or memory mean is reported.

### CI Output

Markdown is emitted between markers for security purposes:

```
::BEGIN_BENCHMARK_REPORT::
...report...
::END_BENCHMARK_REPORT::
```

### Tips

- Re-run if confidence < 95 (possibly noise)
- Compare multiple runs when changes hover near threshold

## 🔧 Configuration & Tuning (`src/config.ts`)

Sampling:

```ts
sampling: {
  minSamples: 100,       // Minimum retained samples
  minExecutionTime: 100, // ms minimum wall time
  warmupSamples: 10,     // Discarded warmup iterations
  batchSize: 100,        // Samples added per loop
}
```

Reliability:

```ts
reliability: {
  epochs: 4,                 // Full suite repetitions
  stabilityThreshold: 0.05,  // 5% significance threshold
}
```

Cache configurations and watcher counts are also declared here. Reduce `epochs`, `minSamples`, and `minExecutionTime` temporarily for faster iteration during local development (but restore defaults before committing).

## ⚙️ How Results Are Produced

For every combination of:

- Operation (auto-discovered from `data/queries/*.graphql` + matching response JSON)
- Scenario (`read`, `write`, `update` in `src/scenarios.ts`)
- Watcher count (from `CONFIG.watcherCounts`)
- Cache configuration (from `CONFIG.cacheConfigurations`)
- Cache factory (`baseline`, `current`)

We run a benchmark in an isolated Node process spawned with conservative GC flags:

```
--noconcurrent_sweeping --noconcurrent_recompilation --expose-gc
```

Methodology (see `benchmark-runner.ts`):

- Warmup: `warmupSamples` discarded
- Sampling loop: keep batching until BOTH `minSamples` and `minExecutionTime` (ms) satisfied
- Per sample: measure high‑resolution time (`process.hrtime.bigint()`) & heap delta (`process.memoryUsage().heapUsed`)
- Outlier filtering: Modified Z‑Score (threshold 3.5) applied to execution & memory sample sets (see `utils/stats.ts`)
- Confidence: `100 - relativeMarginOfError` using z=3.29 (~99.9% two-tailed)
- Multiple epochs (`reliability.epochs`) merge to reduce noise

`benchmark.json` is a map: `{ [benchId]: BenchStats[] }` (one entry per factory/config combination).

## 🧪 Advanced Usage

### Custom Cache Configurations

Add in `CONFIG.cacheConfigurations`:

```ts
{ name: 'My Config', description: 'Describe intent', options: { /* ForestRunAdditionalConfig */ } }
```

Avoid adding large numbers of configs—each multiplies total runtime.

### Adjusting Watcher Counts

Edit `CONFIG.watcherCounts` (e.g. `[0, 10, 50, 100]`). Watchers are registered with `optimistic: true` and an empty callback to simulate subscription overhead.

### Faster Local Loops

Temporarily set:

```ts
sampling: { minSamples: 10, minExecutionTime: 20, warmupSamples: 2, batchSize: 20 }
reliability: { epochs: 1 }
```

Do NOT commit these reduced values.

## ❓ FAQ

| Question                                        | Answer                                                                                                          |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Do I need to build manually before running?     | No, `yarn benchmark` runs `yarn build` first.                                                                   |
| How is the baseline chosen?                     | Latest npm version fetched by `scripts/clone-caches.sh` (edit to pin).                                          |
| Can I run only one scenario?                    | Not yet; the runner iterates all combinations. You can temporarily comment scenarios in `src/scenarios.ts`.     |
| What does `confidence` mean?                    | 100 − relative margin of error (z=3.29). Higher = more stable distribution.                                     |
| Why no variance / p95 reported?                 | Simplicity: mean + threshold work well for internal regression gating. Extend `utils/stats.ts` if needed.       |
| Memory numbers look negative / zero sometimes?  | Negative samples are filtered; only non‑negative retained. Very small deltas may fall below noise.              |
| Why are some cells blank in the markdown table? | Change magnitude < threshold (default 5%).                                                                      |
| How do I reduce noise?                          | Close other apps, disable CPU scaling, run on same hardware, avoid containerized throttling.                    |
| Is GC forced?                                   | A helper triggers `global.gc()` (needs `--expose-gc`) before each grouped benchmark to reduce cross‑test noise. |

## 📚 Glossary

| Term     | Description                                                                   |
| -------- | ----------------------------------------------------------------------------- |
| Factory  | Source of the cache implementation (`baseline` npm vs `current` local build)  |
| Bench    | Unique combination of: operation + scenario + watcherCount                    |
| Scenario | Operation pattern (`read`, `write`, `update`, or custom)                      |
| Watcher  | A operation watcher established via `cache.watch()` to measure overhead       |
| Epoch    | One full sweep over all benches (multiple epochs reduce statistical variance) |

## 📈 Best Practices

1. Keep environment quiet (no concurrent heavy builds or tests)
2. Interpret time + memory together (optimizations may trade one for the other)
3. Add realistic queries (mirror production payload shapes & nesting)
4. Treat single-run anomalies skeptically—rerun if confidence < 95
