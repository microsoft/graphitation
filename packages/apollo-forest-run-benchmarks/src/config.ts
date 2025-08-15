import fs from "fs";
import path from "path";
import { gql } from "@apollo/client";
import type { ConfigTemplate, OperationData } from "./types";

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
    {
      name: "Variable-Based Partitioning",
      description:
        "Partitioned eviction based on variable patterns (divisible by 2, 3)",
      options: {
        unstable_partitionConfig: {
          partitionKey: (operation) => {
            const id = operation.operation.variables?.id;
            const numericId = typeof id === "string" ? parseInt(id, 10) : id;

            if (typeof numericId === "number") {
              if (numericId % 2 === 0) return "even";
              if (numericId % 3 === 0) return "divisible_by_3";
            }

            return null;
          },
          partitions: {
            even: { maxOperationCount: 2 },
            divisible_by_3: { maxOperationCount: 1 },
          },
        },
      },
    },
  ],
  observerCounts: [0, 50],
  targetConfidencePercent: 99.9,
  maxSamplesPerBenchmark: 250,
  warmupSamples: 20,
  batchSize: 200,
  reliability: { maxAttempts: 20, minAttempts: 2 },
} as const satisfies ConfigTemplate;

export type CacheConfig = (typeof CONFIG.cacheConfigurations)[number];
export type TestConfig = typeof CONFIG;

const responsesDir = path.join(__dirname, "responses");
const queriesDir = path.join(__dirname, "queries");
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
    query: gql(source),
    data: JSON.parse(fs.readFileSync(jsonPath, "utf-8")),
    variables: {},
  });
}
