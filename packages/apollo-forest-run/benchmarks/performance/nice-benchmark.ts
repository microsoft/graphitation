/* eslint-disable @typescript-eslint/no-explicit-any */

export interface BenchmarkResult {
  name: string;
  mean: number; // Mean execution time in milliseconds
  rme: number; // Relative margin of error (%)
  samples: number;
  min: number; // Minimum execution time in milliseconds
  max: number; // Maximum execution time in milliseconds
  variance: number;
}

export interface BenchmarkSuiteResult {
  suiteName: string;
  results: BenchmarkResult[];
  benchmarks: BenchmarkResult[]; // Alias for backward compatibility
  timestamp: number;
  fastest: string[];
  slowest: string[];
}

interface BenchmarkFunction {
  name: string;
  fn: () => Promise<void> | void;
}

// Helper function to get z-score for different confidence levels
function getZScore(confidenceLevel: number): number {
  switch (confidenceLevel) {
    case 90: return 1.645;
    case 95: return 1.96;
    case 99: return 2.576;
    case 99.9: return 3.291;
    default:
      // For other confidence levels, use normal distribution approximation
      // This is a simplified approach - for production use, you'd want a proper inverse normal function
      if (confidenceLevel < 90) return 1.645;
      if (confidenceLevel < 95) return 1.96;
      if (confidenceLevel < 99) return 2.576;
      return 3.291;
  }
}

export default class NiceBenchmark {
  private name: string;
  private benchmarks: BenchmarkFunction[] = [];
  private results: BenchmarkResult[] = [];
  private confidenceLevel: number;

  constructor(name: string, confidenceLevel: number = 95) {
    this.name = name;
    this.confidenceLevel = confidenceLevel;
  }

  add(name: string, fn: () => Promise<void> | void) {
    this.benchmarks.push({ name, fn });
  }

  private async measureFunction(name: string, fn: () => Promise<void> | void, minSamples = 200, minTime = 10000): Promise<BenchmarkResult> {
    const samples: number[] = [];
    const warmupSamples = 20; // Warmup runs to eliminate JIT compilation effects
    
    // Warmup phase - don't record these samples
    console.log(`  Warming up ${name}...`);
    for (let i = 0; i < warmupSamples; i++) {
      await fn();
    }
    
    console.log(`  Measuring ${name}...`);
    const startTime = Date.now();

    // Run at least minSamples times or until minTime milliseconds have passed
    while (samples.length < minSamples || (Date.now() - startTime) < minTime) {
      const start = process.hrtime.bigint();
      await fn();
      const end = process.hrtime.bigint();
      
      // Convert nanoseconds to milliseconds
      const duration = Number(end - start) / 1e6;
      samples.push(duration);

      // Allow more samples for better statistical confidence
      if (samples.length >= 1000) break;
    }

    // Remove outliers using the IQR method for more stable results
    const sortedSamples = [...samples].sort((a, b) => a - b);
    const q1 = sortedSamples[Math.floor(sortedSamples.length * 0.25)];
    const q3 = sortedSamples[Math.floor(sortedSamples.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    
    const filteredSamples = samples.filter(sample => sample >= lowerBound && sample <= upperBound);
    
    // Use filtered samples for calculations if we have enough, otherwise use all samples
    const usedSamples = filteredSamples.length >= Math.min(50, samples.length * 0.8) ? filteredSamples : samples;
    
    // Calculate statistics
    const mean = usedSamples.reduce((sum, time) => sum + time, 0) / usedSamples.length;
    const variance = usedSamples.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / usedSamples.length;
    const standardDeviation = Math.sqrt(variance);
    const standardError = standardDeviation / Math.sqrt(usedSamples.length);
    
    // Use configurable confidence level
    const zScore = getZScore(this.confidenceLevel);
    const rme = (standardError / mean) * 100 * zScore;
    
    // Min and max times from used samples
    const min = Math.min(...usedSamples);
    const max = Math.max(...usedSamples);

    return {
      name,
      mean,
      rme,
      samples: usedSamples.length,
      min,
      max,
      variance,
    };
  }

  async run(options?: any): Promise<BenchmarkSuiteResult> {
    console.log(`\n=== ${this.name} ===`);
    this.results = [];

    for (const benchmark of this.benchmarks) {
      const result = await this.measureFunction(benchmark.name, benchmark.fn);
      this.results.push(result);
      
      // Format output to show timing with configured confidence level
      const meanTime = result.mean.toFixed(3);
      const marginOfError = result.rme.toFixed(2);
      console.log(`${result.name}: ${meanTime}ms ±${marginOfError}% (${result.samples} runs sampled, ${this.confidenceLevel}% confidence)`);
    }

    // Find fastest and slowest (by mean time - lower is faster)
    let fastest = this.results[0];
    let slowest = this.results[0];
    
    for (const result of this.results) {
      if (result.mean < fastest.mean) fastest = result;
      if (result.mean > slowest.mean) slowest = result;
    }

    const benchmarkResult: BenchmarkSuiteResult = {
      suiteName: this.name,
      results: this.results,
      benchmarks: this.results, // Alias for backward compatibility
      timestamp: Date.now(),
      fastest: [fastest.name],
      slowest: [slowest.name],
    };

    console.log(`Fastest is ${fastest.name}`);
    return benchmarkResult;
  }
}