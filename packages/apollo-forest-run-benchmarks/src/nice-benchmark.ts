/* eslint-disable @typescript-eslint/no-explicit-any */

export interface BenchmarkResult {
  name: string;
  mean: number; // Mean execution time in milliseconds
  rme: number; // Relative margin of error (%)
  samples: number;
  confidence: number; // Actual confidence level achieved (%)
}

export interface BenchmarkSuiteResult {
  suiteName: string;
  results: BenchmarkResult[];
}

interface BenchmarkFunction {
  name: string;
  fn: () => Promise<void> | void;
}

// Simple statistics class with the methods requested by the user
class Stats {
  private samples: number[];

  constructor(samples: number[]) {
    this.samples = [...samples]; // Copy to avoid mutation
  }

  // Arithmetic mean
  amean(): number {
    return (
      this.samples.reduce((sum, val) => sum + val, 0) / this.samples.length
    );
  }

  // Margin of error (absolute)
  moe(): number {
    if (this.samples.length < 2) return 0;

    const mean = this.amean();
    const variance =
      this.samples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      (this.samples.length - 1);
    const standardDeviation = Math.sqrt(variance);
    const standardError = standardDeviation / Math.sqrt(this.samples.length);

    // Use 1.96 (95% confidence) as a simple baseline for margin of error calculation
    return 1.96 * standardError;
  }
}

// Calculate relative margin of error as percentage using the user's formula
function percentRelativeMarginOfError(stats: Stats) {
  return (stats.moe() / stats.amean()) * 100;
}

export default class NiceBenchmark {
  private name: string;
  private benchmarks: BenchmarkFunction[] = [];
  private results: BenchmarkResult[] = [];
  private targetConfidence: number;

  constructor(name: string, targetConfidence = 95) {
    this.name = name;
    this.targetConfidence = targetConfidence;
  }

  add(name: string, fn: () => Promise<void> | void) {
    this.benchmarks.push({ name, fn });
  }

  private async measureFunction(
    name: string,
    fn: () => Promise<void> | void,
  ): Promise<BenchmarkResult> {
    const samples: number[] = [];
    const warmupSamples = 20; // Warmup runs to eliminate JIT compilation effects
    const batchSize = 50; // Run 50 samples at a time
    const maxSamples = 1000; // Maximum total samples

    // Warmup phase - don't record these samples
    for (let i = 0; i < warmupSamples; i++) {
      await fn();
    }

    let currentConfidence = 0; // Start with 0% confidence

    // Run in batches until we achieve target confidence
    while (
      currentConfidence < this.targetConfidence &&
      samples.length < maxSamples
    ) {
      // Run a batch of samples
      for (let i = 0; i < batchSize; i++) {
        const start = process.hrtime.bigint();
        await fn();
        const end = process.hrtime.bigint();

        // Convert nanoseconds to milliseconds
        const duration = Number(end - start) / 1e6;
        samples.push(duration);
      }

      // Calculate current confidence after this batch
      if (samples.length >= 10) {
        // Need minimum samples for meaningful calculation
        const stats = new Stats(samples);
        const relativeMarginOfError = percentRelativeMarginOfError(stats);
        currentConfidence = 100 - relativeMarginOfError;
      }
    }

    // Remove outliers using the IQR method for more stable results
    const sortedSamples = [...samples].sort((a, b) => a - b);
    const q1 = sortedSamples[Math.floor(sortedSamples.length * 0.25)];
    const q3 = sortedSamples[Math.floor(sortedSamples.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    const filteredSamples = samples.filter(
      (sample) => sample >= lowerBound && sample <= upperBound,
    );

    // Use filtered samples for calculations if we have enough, otherwise use all samples
    const usedSamples =
      filteredSamples.length >= Math.min(50, samples.length * 0.8)
        ? filteredSamples
        : samples;

    // Calculate final statistics using the new Stats class
    const stats = new Stats(usedSamples);
    const mean = stats.amean();
    const relativeMarginOfError = percentRelativeMarginOfError(stats);
    const finalConfidence = 100 - relativeMarginOfError;

    return {
      name,
      mean,
      rme: relativeMarginOfError,
      samples: usedSamples.length,
      confidence: finalConfidence,
    };
  }

  async run(_options?: unknown): Promise<BenchmarkSuiteResult> {
    this.results = [];

    for (const benchmark of this.benchmarks) {
      const result = await this.measureFunction(benchmark.name, benchmark.fn);
      this.results.push(result);
    }

    const benchmarkResult: BenchmarkSuiteResult = {
      suiteName: this.name,
      results: this.results,
    };

    return benchmarkResult;
  }
}
