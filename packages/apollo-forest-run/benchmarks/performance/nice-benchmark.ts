/* eslint-disable @typescript-eslint/no-explicit-any */

export interface BenchmarkResult {
  name: string;
  mean: number; // Mean execution time in milliseconds
  rme: number; // Relative margin of error (%)
  samples: number;
  min: number; // Minimum execution time in milliseconds
  max: number; // Maximum execution time in milliseconds
  variance: number;
  confidenceLevel: number; // Actual confidence level achieved
}

export interface BenchmarkSuiteResult {
  suiteName: string;
  results: BenchmarkResult[];
}

interface BenchmarkFunction {
  name: string;
  fn: () => Promise<void> | void;
}

// Helper function to get t-score for different confidence levels and degrees of freedom
function getTScore(confidenceLevel: number, degreesOfFreedom: number): number {
  // For sample sizes >= 30, t-distribution approaches normal distribution
  // For smaller samples, we use approximated t-values
  
  if (degreesOfFreedom >= 30) {
    // Use z-scores for large samples
    switch (confidenceLevel) {
      case 90: return 1.645;
      case 95: return 1.96;
      case 99: return 2.576;
      case 99.9: return 3.291;
      default:
        if (confidenceLevel <= 90) return 1.645;
        if (confidenceLevel <= 95) return 1.96;
        if (confidenceLevel <= 99) return 2.576;
        return 3.291;
    }
  }
  
  // Simplified t-values for small samples (approximation)
  // In practice, you'd use a proper t-table or statistical library
  const zScore = (() => {
    switch (confidenceLevel) {
      case 90: return 1.645;
      case 95: return 1.96;
      case 99: return 2.576;
      case 99.9: return 3.291;
      default:
        if (confidenceLevel <= 90) return 1.645;
        if (confidenceLevel <= 95) return 1.96;
        if (confidenceLevel <= 99) return 2.576;
        return 3.291;
    }
  })();
  
  // Adjust for small sample size (t-distribution has heavier tails)
  const adjustment = 1 + (2.5 / degreesOfFreedom);
  return zScore * adjustment;
}

// Calculate margin of error as percentage of mean
function calculateMarginOfError(samples: number[], mean: number, confidenceLevel: number): number {
  if (samples.length < 2) return 100; // Can't calculate with less than 2 samples
  
  const variance = samples.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / (samples.length - 1);
  const standardDeviation = Math.sqrt(variance);
  const standardError = standardDeviation / Math.sqrt(samples.length);
  
  const tScore = getTScore(confidenceLevel, samples.length - 1);
  const marginOfErrorAbsolute = tScore * standardError;
  
  // Return as percentage of mean
  return (marginOfErrorAbsolute / mean) * 100;
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

  private async measureFunction(name: string, fn: () => Promise<void> | void): Promise<BenchmarkResult> {
    const samples: number[] = [];
    const warmupSamples = 20; // Warmup runs to eliminate JIT compilation effects
    const batchSize = 50; // Run 50 samples at a time
    const maxSamples = 1000; // Maximum total samples
    const targetMarginOfError = 5; // Target 5% margin of error
    
    // Warmup phase - don't record these samples
    console.log(`  Warming up ${name}...`);
    for (let i = 0; i < warmupSamples; i++) {
      await fn();
    }
    
    console.log(`  Measuring ${name} (target: ${this.confidenceLevel}% confidence, ≤${targetMarginOfError}% margin of error)...`);
    
    let currentMarginOfError = 100; // Start with 100% margin of error
    let batchCount = 0;
    
    // Run in batches until we achieve target confidence with reasonable margin of error
    while (currentMarginOfError > targetMarginOfError && samples.length < maxSamples) {
      batchCount++;
      console.log(`    Running batch ${batchCount} (${batchSize} samples)...`);
      
      // Run a batch of samples
      for (let i = 0; i < batchSize; i++) {
        const start = process.hrtime.bigint();
        await fn();
        const end = process.hrtime.bigint();
        
        // Convert nanoseconds to milliseconds
        const duration = Number(end - start) / 1e6;
        samples.push(duration);
      }
      
      // Calculate current margin of error after this batch
      if (samples.length >= 10) { // Need minimum samples for meaningful calculation
        const mean = samples.reduce((sum, time) => sum + time, 0) / samples.length;
        currentMarginOfError = calculateMarginOfError(samples, mean, this.confidenceLevel);
        console.log(`    Current margin of error: ±${currentMarginOfError.toFixed(2)}% (${samples.length} samples)`);
      }
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
    
    // Calculate final statistics
    const mean = usedSamples.reduce((sum, time) => sum + time, 0) / usedSamples.length;
    const variance = usedSamples.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / (usedSamples.length - 1);
    const standardDeviation = Math.sqrt(variance);
    
    // Calculate final margin of error
    const finalMarginOfError = calculateMarginOfError(usedSamples, mean, this.confidenceLevel);
    
    // Min and max times from used samples
    const min = Math.min(...usedSamples);
    const max = Math.max(...usedSamples);

    console.log(`    Final margin of error: ±${finalMarginOfError.toFixed(2)}% at ${this.confidenceLevel}% confidence`);

    return {
      name,
      mean,
      rme: finalMarginOfError,
      samples: usedSamples.length,
      min,
      max,
      variance,
      confidenceLevel: this.confidenceLevel, // Report requested confidence level
    };
  }

  async run(options?: any): Promise<BenchmarkSuiteResult> {
    console.log(`\n=== ${this.name} ===`);
    this.results = [];

    for (const benchmark of this.benchmarks) {
      const result = await this.measureFunction(benchmark.name, benchmark.fn);
      this.results.push(result);
      
      // Format output to show timing with confidence level
      const meanTime = result.mean.toFixed(3);
      const marginOfError = result.rme.toFixed(2);
      console.log(`${result.name}: ${meanTime}ms ±${marginOfError}% (${result.samples} runs sampled, ${result.confidenceLevel}% confidence)`);
    }

    const benchmarkResult: BenchmarkSuiteResult = {
      suiteName: this.name,
      results: this.results,
    };

    return benchmarkResult;
  }
}