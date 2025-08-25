import fs from "fs";
import path from "path";
import { parse } from "graphql";
import type { OperationData } from "./types";

export const OPERATIONS: OperationData[] = [];

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
  minSamples: 400,
  minExecutionTime: 150, //ms
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

const responsesDir = path.join(__dirname, "data", "responses");
const queriesDir = path.join(__dirname, "data", "queries");
const discoveredQueries: Record<string, string> = Object.fromEntries(
  fs
    .readdirSync(queriesDir)
    .filter((f) => f.endsWith(".graphql"))
    .map((f) => [f.replace(/\.graphql$/, ""), f]),
);

for (const [key, filename] of Object.entries(discoveredQueries)) {
  const source = fs.readFileSync(path.join(queriesDir, filename), "utf-8");
  const jsonPath = path.join(
    responsesDir,
    filename.replace(/\.graphql$/, ".json"),
  );

  OPERATIONS.push({
    name: key,
    query: parse(source),
    data: JSON.parse(fs.readFileSync(jsonPath, "utf-8")),
    variables: {},
  });
}

export type CacheConfig = (typeof CONFIG.cacheConfigurations)[number];
export type TestConfig = typeof CONFIG;
