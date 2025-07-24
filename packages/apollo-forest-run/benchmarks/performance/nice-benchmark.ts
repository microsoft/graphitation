/* eslint-disable @typescript-eslint/no-explicit-any */

import { Suite } from "benchmark";

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

export default class NiceBenchmark {
  private name: string;
  private suite: Suite;
  private results: BenchmarkResult[] = [];

  constructor(name: string) {
    this.name = name;
    this.suite = new Suite(name);
    this.suite.on("cycle", (event: any) => {
      const benchmark = event.target;
      const result: BenchmarkResult = {
        name: benchmark.name,
        hz: benchmark.hz,
        rme: benchmark.stats.rme,
        samples: benchmark.stats.sample.length,
        mean: benchmark.stats.mean,
        variance: benchmark.stats.variance,
      };
      this.results.push(result);
      console.log(String(event.target));
    });
  }

  add(name: string, fn: () => Promise<void> | void) {
    this.suite.add(name, {
      defer: true,
      fn: async (deferred: any) => {
        await fn();
        deferred.resolve();
      },
    });
  }

  run(options?: any): Promise<BenchmarkSuiteResult> {
    return new Promise((resolve) => {
      this.suite.on("complete", () => {
        const fastest = this.suite.filter("fastest").map("name")[0];
        const slowest = this.suite.filter("slowest").map("name")[0];
        
        const result: BenchmarkSuiteResult = {
          suiteName: this.name,
          results: this.results,
          timestamp: Date.now(),
          fastest,
          slowest,
        };
        
        console.log(`Fastest is ${fastest}`);
        resolve(result);
      });
      console.log(`\n=== ${this.name} ===`);
      this.suite.run(options);
    });
  }
}