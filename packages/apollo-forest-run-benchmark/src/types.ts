import type {
  ForestRun,
  ForestRunAdditionalConfig,
} from "@graphitation/apollo-forest-run";
import type { scenarios } from "./scenarios";
import type { CACHE_FACTORIES, CONFIG } from "./config";

export interface CacheConfiguration {
  name: string;
  description: string;
  options: ForestRunAdditionalConfig;
}

export interface OperationData {
  name: string;
  query: any;
  data: any;
  variables: Record<string, any>;
}
export interface ScenarioContext extends OperationData {
  observerCount: number;
  cacheFactory: typeof ForestRun;
  configuration: ForestRunAdditionalConfig;
}

export type Scenario = {
  name: string;
  prepare: (ctx: ScenarioContext) => {
    run: () => void;
  };
};

export interface Sample {
  time: number;
  memory: number;
}

export interface BenchStats extends Omit<BenchBase, "benchId"> {
  confidence: number;
  samples: number;
  mean: number;
  tasksPerMs: number;
  memoryStats: number;
  gcStats?: {
    runs: number;
    totalMemoryFreed: number;
    avgMemoryFreed: number;
  };
}
export type BenchId =
  `${string}_${(typeof scenarios)[number]["name"]}_${number}`;
export interface BenchBase {
  cacheConfig: CacheConfig["name"];
  cacheFactory: (typeof CACHE_FACTORIES)[number]["name"];
  benchId: BenchId;
}

export interface BenchRaw extends BenchBase {
  samples: Sample[];
}

export interface Bench extends BenchBase {
  memorySamples: number[];
  executionSamples: number[];
}

export type CacheConfig = (typeof CONFIG.cacheConfigurations)[number];
export type TestConfig = typeof CONFIG;
export interface SuiteRawResult {
  [scenarioId: BenchId]: BenchRaw[];
}

export interface SuiteResult {
  [scenarioId: BenchId]: Bench[];
}

export interface WorkerResult {
  results: BenchRaw[];
  gcStats: {
    runs: number;
    totalMemoryFreed: number;
  };
}
