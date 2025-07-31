/* eslint-disable @typescript-eslint/no-explicit-any */

export interface BenchmarkResult {
  name: string;
  hz: number; // Operations per second
  rme: number; // Relative margin of error (%)
  samples: number;
  mean: number; // Mean execution time in seconds
  variance: number;
}

export interface BenchmarkSuiteResult {
  suiteName: string;
  results: BenchmarkResult[];
  timestamp: number;
  fastest: string;
  slowest: string;
}

interface BenchmarkFunction {
  name: string;
  fn: () => Promise<void> | void;
}

export default class NiceBenchmark {
  private name: string;
  private benchmarks: BenchmarkFunction[] = [];
  private results: BenchmarkResult[] = [];

  constructor(name: string) {
    this.name = name;
  }

  add(name: string, fn: () => Promise<void> | void) {
    this.benchmarks.push({ name, fn });
  }

  private async measureFunction(name: string, fn: () => Promise<void> | void, minSamples = 5, minTime = 1000): Promise<BenchmarkResult> {
    const samples: number[] = [];
    const startTime = Date.now();

    // Run at least minSamples times or until minTime milliseconds have passed
    while (samples.length < minSamples || (Date.now() - startTime) < minTime) {
      const start = process.hrtime.bigint();
      await fn();
      const end = process.hrtime.bigint();
      
      // Convert nanoseconds to seconds
      const duration = Number(end - start) / 1e9;
      samples.push(duration);

      // Don't run too many samples to avoid excessive execution time
      if (samples.length >= 100) break;
    }

    // Calculate statistics
    const mean = samples.reduce((sum, time) => sum + time, 0) / samples.length;
    const variance = samples.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / samples.length;
    const standardDeviation = Math.sqrt(variance);
    const standardError = standardDeviation / Math.sqrt(samples.length);
    
    // Relative margin of error as percentage (using 95% confidence interval)
    const rme = (standardError / mean) * 100 * 1.96;
    
    // Operations per second
    const hz = 1 / mean;

    return {
      name,
      hz,
      rme,
      samples: samples.length,
      mean,
      variance,
    };
  }

  async run(options?: any): Promise<BenchmarkSuiteResult> {
    console.log(`\n=== ${this.name} ===`);
    this.results = [];

    for (const benchmark of this.benchmarks) {
      const result = await this.measureFunction(benchmark.name, benchmark.fn);
      this.results.push(result);
      
      // Format output similar to benchmark.js
      const opsPerSec = result.hz.toLocaleString('en-US', { maximumFractionDigits: 2 });
      const marginOfError = result.rme.toFixed(2);
      console.log(`${result.name} x ${opsPerSec} ops/sec ±${marginOfError}% (${result.samples} runs sampled)`);
    }

    // Find fastest and slowest
    let fastest = this.results[0];
    let slowest = this.results[0];
    
    for (const result of this.results) {
      if (result.hz > fastest.hz) fastest = result;
      if (result.hz < slowest.hz) slowest = result;
    }

    const benchmarkResult: BenchmarkSuiteResult = {
      suiteName: this.name,
      results: this.results,
      timestamp: Date.now(),
      fastest: fastest.name,
      slowest: slowest.name,
    };

    console.log(`Fastest is ${fastest.name}`);
    return benchmarkResult;
  }
}