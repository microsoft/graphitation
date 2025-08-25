export class Stats {
  public samples: number[];
  public rawSamples: number[];
  public tasksPerMs: number;

  constructor(samples: number[]) {
    this.rawSamples = [...samples];
    this.samples = this.applyOutlierFiltering(samples);
    const totalNs = this.samples.reduce((sum, v) => sum + v, 0);
    this.tasksPerMs = this.samples.length / (totalNs / 1_000_000);
  }

  private applyOutlierFiltering(values: number[]): number[] {
    if (values.length < 10) return values; // Not enough data for filtering

    const sorted = [...values].sort((a, b) => a - b);

    // Use more conservative Modified Z-Score method for better outlier detection
    const median = this.getMedian(sorted);
    const mad = this.getMAD(sorted, median);

    if (mad === 0) return sorted; // No variation, keep all samples

    const threshold = 3.5; // Conservative threshold
    return sorted.filter((value) => {
      const modifiedZScore = (0.6745 * (value - median)) / mad;
      return Math.abs(modifiedZScore) < threshold;
    });
  }

  private getMedian(sortedValues: number[]): number {
    const mid = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2 === 0
      ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
      : sortedValues[mid];
  }

  private getMAD(sortedValues: number[], median: number): number {
    const deviations = sortedValues.map((value) => Math.abs(value - median));
    deviations.sort((a, b) => a - b);
    return this.getMedian(deviations);
  }

  get arithmeticMean(): number {
    return this.samples.reduce((sum, v) => sum + v, 0) / this.samples.length;
  }

  get median(): number {
    const sorted = [...this.samples].sort((a, b) => a - b);
    return this.getMedian(sorted);
  }

  variance(): number {
    if (this.samples.length < 2) return 0;
    const mean = this.arithmeticMean;
    return (
      this.samples.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) /
      (this.samples.length - 1)
    );
  }

  standardDeviation(): number {
    return Math.sqrt(this.variance());
  }

  get marginOfError(): number {
    // z for 99.9% two-tailed confidence ≈ 3.29
    return 3.29 * (this.standardDeviation() / Math.sqrt(this.samples.length));
  }

  get relativeMarginOfError(): number {
    const mean = this.arithmeticMean;
    if (mean === 0) return 0;
    return (this.marginOfError / mean) * 100;
  }

  get confidence(): number {
    return 100 - this.relativeMarginOfError;
  }

  // Additional statistical measures for better analysis
  get coefficientOfVariation(): number {
    const mean = this.arithmeticMean;
    return mean === 0 ? 0 : (this.standardDeviation() / mean) * 100;
  }

  get outlierRatio(): number {
    return (
      (this.rawSamples.length - this.samples.length) / this.rawSamples.length
    );
  }
}
