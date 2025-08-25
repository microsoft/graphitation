import type {
  ForestRun,
  ForestRunAdditionalConfig,
} from "@graphitation/apollo-forest-run";
import type { Scenario, OperationData, RunStats } from "./types";

import { CONFIG } from "./config";
import { do_not_optimize } from "./do-no-optimaze";

export class Stats {
  public samples: number[];
  public tasksPerMs: number;
  constructor(samples: number[], executionTime: number) {
    this.samples = this.applyIQR(samples);
    this.tasksPerMs = samples.length / executionTime;
  }

  private applyIQR(values: number[]): number[] {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;
    return sorted.filter((v) => v >= lower && v <= upper);
  }

  get arithmeticMean(): number {
    return this.samples.reduce((sum, v) => sum + v, 0) / this.samples.length;
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
}

export function benchmarkOperation(
  operation: OperationData,
  scenario: Scenario,
  observerCount: number,
  cacheFactory: typeof ForestRun,
  configuration: ForestRunAdditionalConfig,
): RunStats {
  const task = () => {
    const prepared = scenario.prepare({
      observerCount,
      cacheFactory,
      configuration,
      ...operation,
    });
    const start = performance.now();
    const result = do_not_optimize(prepared.run());
    const end = performance.now();
    return end - start; // ms
  };

  const samples: number[] = [];
  for (let i = 0; i < CONFIG.warmupSamples; i++) {
    task();
  }

  const iterationStart = performance.now();
  while (
    performance.now() - iterationStart < CONFIG.minExecutionTime ||
    samples.length < CONFIG.minSamples
  ) {
    for (let i = 0; i < CONFIG.batchSize; i++) {
      samples.push(task());
    }
  }

  return {
    samples,
    executionTime: performance.now() - iterationStart,
  };
}
