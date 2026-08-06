import type { CacheConfiguration } from "./types";

export const CONFIG = {
  cacheConfigurations: [
    {
      name: "Default",
      description:
        "cleanupNonCacheableOperations disabled (default, matches PR #705 baseline behavior)",
      options: { cleanupNonCacheableOperations: false, autoEvict: false },
    },
    {
      name: "cleanupNonCacheableOperations enabled",
      description:
        "cleanupNonCacheableOperations enabled (PR #705 feature under evaluation)",
      options: { cleanupNonCacheableOperations: true, autoEvict: false },
    },
  ] as const satisfies CacheConfiguration[],
  watcherCounts: [0],
  sampling: {
    minSamples: 200,
    minExecutionTime: 200, //ms
    warmupSamples: 25,
    batchSize: 50,
  },
  reliability: {
    epochs: 6,
    stabilityThreshold: 0.05,
  },
} as const;

export const CACHE_FACTORIES = [
  {
    name: "baseline",
    importPath: "../../forest-runs/baseline",
  },
  {
    name: "current",
    importPath: "../../forest-runs/current",
  },
] as const;
