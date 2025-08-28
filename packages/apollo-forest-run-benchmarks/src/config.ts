import type { ForestRunAdditionalConfig } from "@graphitation/apollo-forest-run";

interface CacheConfigTemplate extends ForestRunAdditionalConfig {
  name: string;
  description: string;
  options: ForestRunAdditionalConfig;
}

export type CacheConfig = (typeof CONFIG.cacheConfigurations)[number];
export type TestConfig = typeof CONFIG;
export interface ResultIdentifier {
  cacheConfig: CacheConfig["name"];
  cacheFactory: (typeof CACHE_FACTORIES)[number]["name"];
}

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
  ] satisfies CacheConfigTemplate[],
  observerCounts: [0, 50],
  targetConfidencePercent: 99.9,
  minSamples: 400,
  minExecutionTime: 200, //ms
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
