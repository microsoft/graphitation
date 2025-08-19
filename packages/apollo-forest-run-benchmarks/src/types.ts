import type {
  ForestRun,
  ForestRunAdditionalConfig,
} from "@graphitation/apollo-forest-run";
import { TestConfig } from "./config";

interface CacheConfiguration {
  name: string;
  description: string;
  options: ForestRunAdditionalConfig;
}

interface CacheConfigQueryOperations {
  queryName: string;
  operations: Record<string, number[]>;
}

interface Results {
  configuration: CacheConfiguration;
  queryResults: CacheConfigQueryOperations[];
}

export interface BenchmarkReport {
  config: TestConfig;
  cacheConfigResults: Results[];
}

export interface ScenarioContext extends OperationData {
  observerCount: number;
  cacheFactory: (config?: ForestRunAdditionalConfig) => ForestRun;
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

export interface BenchmarkStats {
  confidence: number;
  samples: number;
  mean: number;
}
