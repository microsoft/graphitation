import type { CacheConfiguration } from "./types";

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
  ] as const satisfies CacheConfiguration[],
  observerCounts: [0, 50],
  targetConfidencePercent: 99.9,
  minSamples: 400,
  minExecutionTime: 250, //ms
  warmupSamples: 50,
  batchSize: 100,
  reliability: { maxAttempts: 12, minAttempts: 3 },
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
