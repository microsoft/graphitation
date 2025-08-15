import type { ForestRunAdditionalConfig } from "@graphitation/apollo-forest-run";
import { TestConfig } from "./config";

export interface CacheConfiguration {
  name: string;
  description: string;
  options: ForestRunAdditionalConfig;
}

export interface ConfigTemplate {
  cacheConfigurations: CacheConfiguration[];
  observerCounts: number[];
  // Desired statistical confidence percentage (e.g. 99 => stop when RME <= 1)
  targetConfidencePercent: number;
  maxSamplesPerBenchmark: number;
  warmupSamples: number;
  batchSize: number;
  reliability: {
    maxAttempts: number;
    minAttempts: number;
  };
}

export interface CacheConfigQueryOperations {
  queryName: string;
  operations: Record<string, number[]>;
}

export interface CacheConfigResults {
  configuration: CacheConfiguration;
  queryResults: CacheConfigQueryOperations[];
}

export interface BenchmarkReport {
  config: TestConfig;
  cacheConfigResults: CacheConfigResults[];
}

export interface ScenarioContext extends OperationData {
  cacheConfig: CacheConfiguration;
  observerCount: number;
}
export type SampleFunction = () => number;

export type Scenario = {
  name: string;
  observerCounts?: readonly number[];
  prepare: (ctx: ScenarioContext) => {
    run: () => void;
  };
};

export interface OperationData {
  name: string;
  query: any;
  data: any;
  variables: Record<string, any>;
}
