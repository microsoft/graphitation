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

// Helper function to calculate actual confidence level achieved from z-score
function getConfidenceFromZScore(zScore: number): number {
  if (zScore >= 3.291) return 99.9;
  if (zScore >= 2.576) return 99;
  if (zScore >= 1.96) return 95;
  if (zScore >= 1.645) return 90;
  // For lower z-scores, interpolate or return lower confidence
  return Math.max(80, 90 * (zScore / 1.645));
}

// Calculate actual confidence level achieved with current statistics
function calculateActualConfidence(samples: number[], mean: number): number {
  if (samples.length < 10) return 0; // Need minimum samples for meaningful confidence
  
  const variance = samples.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / samples.length;
  const standardDeviation = Math.sqrt(variance);
  const standardError = standardDeviation / Math.sqrt(samples.length);
  
  // Calculate what z-score would give us a reasonable margin of error (e.g., 5%)
  const targetMarginOfError = 5; // 5% margin of error
  const zScore = (targetMarginOfError * mean) / (standardError * 100);
  
  return getConfidenceFromZScore(zScore);
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
    
    // Warmup phase - don't record these samples
    console.log(`  Warming up ${name}...`);
    for (let i = 0; i < warmupSamples; i++) {
      await fn();
    }
    
    console.log(`  Measuring ${name} (target: ${this.confidenceLevel}% confidence)...`);
    
    let currentConfidence = 0;
    let batchCount = 0;
    
    // Run in batches until we achieve target confidence or reach max samples
    while (currentConfidence < this.confidenceLevel && samples.length < maxSamples) {
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
      
      // Calculate current confidence after this batch
      if (samples.length >= 50) { // Need minimum samples for meaningful confidence calculation
        const mean = samples.reduce((sum, time) => sum + time, 0) / samples.length;
        currentConfidence = calculateActualConfidence(samples, mean);
        console.log(`    Current confidence: ${currentConfidence.toFixed(1)}% (${samples.length} samples)`);
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
    const variance = usedSamples.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / usedSamples.length;
    const standardDeviation = Math.sqrt(variance);
    const standardError = standardDeviation / Math.sqrt(usedSamples.length);
    
    // Calculate final confidence and margin of error
    const finalConfidence = calculateActualConfidence(usedSamples, mean);
    const zScore = getZScore(finalConfidence);
    const rme = (standardError / mean) * 100 * zScore;
    
    // Min and max times from used samples
    const min = Math.min(...usedSamples);
    const max = Math.max(...usedSamples);

    console.log(`    Final confidence achieved: ${finalConfidence.toFixed(1)}%`);

    return {
      name,
      mean,
      rme,
      samples: usedSamples.length,
      min,
      max,
      variance,
      confidenceLevel: finalConfidence, // Report actual confidence achieved
    };
  }

  async run(options?: any): Promise<BenchmarkSuiteResult> {
    console.log(`\n=== ${this.name} ===`);
    this.results = [];

    for (const benchmark of this.benchmarks) {
      const result = await this.measureFunction(benchmark.name, benchmark.fn);
      this.results.push(result);
      
      // Format output to show timing with actual confidence level achieved
      const meanTime = result.mean.toFixed(3);
      const marginOfError = result.rme.toFixed(2);
      console.log(`${result.name}: ${meanTime}ms ±${marginOfError}% (${result.samples} runs sampled, ${result.confidenceLevel.toFixed(1)}% confidence)`);
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