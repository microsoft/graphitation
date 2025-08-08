import type {
  BenchmarkResultPoint,
  BenchmarkSuiteResult,
  Config,
} from "./types";

// Exported for reuse in aggregation logic (outlier filtering, recomputation)
export class Stats {
  private raw: number[];
  private filtered: number[];
  constructor(samples: number[]) {
    this.raw = samples;
    this.filtered = this.applyIQR(samples);
  }

  private applyIQR(values: number[]): number[] {
    if (values.length < 5) return values; // too small to filter
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    if (iqr === 0) return values; // all similar
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    const filtered = sorted.filter((v) => v >= lower && v <= upper);
    // Only accept filtering if at least half remain (avoid over-pruning) and >=5 samples
    if (filtered.length >= Math.max(5, Math.floor(values.length * 0.5))) {
      return filtered;
    }
    return values;
  }

  private get samples(): number[] {
    return this.filtered;
  }

  arithmeticMean(): number {
    return this.samples.reduce((sum, v) => sum + v, 0) / this.samples.length;
  }
  variance(): number {
    if (this.samples.length < 2) return 0;
    const mean = this.arithmeticMean();
    return (
      this.samples.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) /
      (this.samples.length - 1)
    );
  }
  standardDeviation(): number {
    return Math.sqrt(this.variance());
  }
  marginOfError(): number {
    // z for 99.9% two-tailed confidence ≈ 3.291
    return 3.291 * (this.standardDeviation() / Math.sqrt(this.samples.length));
  }
  relativeMarginOfError(): number {
    const mean = this.arithmeticMean();
    if (mean === 0) return 0;
    return (this.marginOfError() / mean) * 100;
  }
  rawSampleCount(): number {
    return this.raw.length;
  }
  effectiveSampleCount(): number {
    return this.filtered.length;
  }
  getFilteredSamples(): number[] {
    return [...this.filtered];
  }
}

type SampleFunction = () => number | Promise<number>;

export class AdaptiveBenchmarkSuite {
  private benchmarkTasks: Array<{
    name: string;
    sampleFunction: SampleFunction;
  }> = [];
  private suiteName: string;
  private options: Config;

  constructor(suiteName: string, options: Config) {
    this.suiteName = suiteName;
    this.options = options;
  }

  add(name: string, sampleFunction: SampleFunction) {
    this.benchmarkTasks.push({ name, sampleFunction });
  }

  private async measure(
    name: string,
    sampleFunction: SampleFunction,
  ): Promise<BenchmarkResultPoint> {
    const samples: number[] = [];
    for (let i = 0; i < this.options.warmupSamples; i++) {
      await sampleFunction();
    }
    const targetRME = 100 - this.options.targetConfidencePercent; // e.g. 99% confidence => RME <= 1
    while (samples.length < this.options.maxSamplesPerBenchmark) {
      for (let i = 0; i < this.options.batchSize; i++) {
        samples.push(await sampleFunction());
        if (samples.length >= this.options.maxSamplesPerBenchmark) break;
      }
      const stats = new Stats(samples);
      if (stats.relativeMarginOfError() <= targetRME) break;
    }
    const stats = new Stats(samples);
    const mean = stats.arithmeticMean();
    const rme = stats.relativeMarginOfError();
    const confidence = 100 - rme;
    return {
      name,
      mean,
      rme,
      samples: stats.effectiveSampleCount(),
      confidence,
      rawSamples: stats.getFilteredSamples(),
    };
  }

  async run(): Promise<BenchmarkSuiteResult> {
    const results: BenchmarkResultPoint[] = [];
    for (const task of this.benchmarkTasks)
      results.push(await this.measure(task.name, task.sampleFunction));
    return { suiteName: this.suiteName, results };
  }
}
