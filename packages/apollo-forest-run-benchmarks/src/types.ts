import type {
  ForestRunAdditionalConfig,
  ForestRun,
} from "@graphitation/apollo-forest-run";

export interface CacheConfiguration {
  name: string;
  description: string;
  options: ForestRunAdditionalConfig;
}

export interface Config {
  queries: Record<string, string>;
  cacheConfigurations: CacheConfiguration[];
  observerCounts: number[];
  // Desired statistical confidence percentage (e.g. 99 => stop when RME <= 1)
  targetConfidencePercent: number;
  maxSamplesPerBenchmark: number;
  warmupSamples: number;
  batchSize: number;
  reliability: {
    thresholdPercent: number;
    maxAttempts: number;
    requiredConsecutive: number;
  };
}

export interface BenchmarkResultPoint {
  name: string; // scenario label
  mean: number; // average execution time in ms
  rme: number; // relative margin of error in %
  samples: number; // effective sample count after outlier filtering
  confidence: number; // statistical confidence percentage (100 - rme)
  rawSamples: number[]; // filtered samples used for calculations
}

export interface BenchmarkSuiteResult {
  suiteName: string;
  results: BenchmarkResultPoint[];
}

export interface CacheConfigQueryOperations {
  queryName: string;
  operations: Record<string, BenchmarkSuiteResult>; // key pattern: `${operation}_${observerCount}`
}

export interface CacheConfigResults {
  configuration: CacheConfiguration;
  queryResults: CacheConfigQueryOperations[];
}

export interface BenchmarkReport {
  config: Config;
  cacheConfigResults: CacheConfigResults[];
}

export type OperationType = "read" | "write" | "update";

export interface ScenarioContext {
  cache: ForestRun;
  query: any; // DocumentNode (kept as any to avoid pulling apollo types here)
  variables: Record<string, any>;
  data: any; // result data object
  observerCount: number;
  operation: OperationType;
}

export interface ScenarioDefinition {
  id: string; // stable id e.g. read_0, write_20
  label: string; // human readable label
  operation: OperationType;
  observerCount: number;
  // prepare runs outside timed region (populate cache, install watchers)
  prepare(ctx: ScenarioContext): {
    run(): void | Promise<void>;
    cleanup?(): void | Promise<void>;
  };
}
