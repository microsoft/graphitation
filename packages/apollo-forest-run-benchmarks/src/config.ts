import type { OperationData } from "./types";

export const CONFIG = {
  cacheConfigurations: [
    {
      name: "Default",
      description: "Default ForestRun configuration",
      options: {},
    },
    {
      name: "Telemetry enabled",
      description: "Enable telemetry for cache operations",
      options: { logStaleOperations: true, logUpdateStats: true },
    },
  ],
  observerCounts: [0, 50],
  targetConfidencePercent: 99.9,
  minSamples: 600,
  minExecutionTime: 200, //ms
  warmupSamples: 50,
  batchSize: 200,
  reliability: { maxAttempts: 10, minAttempts: 3 },
  significantChanges: { threshold: 0.05 },
} as const;

export const CACHE_FACTORIES = [
  {
    name: "baseline",
    importPath: "./forest-runs/baseline",
  },
  {
    name: "current",
    importPath: "./forest-runs/current",
  },
] as const;

export type CacheConfig = (typeof CONFIG.cacheConfigurations)[number];
export type TestConfig = typeof CONFIG;
