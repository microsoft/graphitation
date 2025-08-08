import fs from "fs";
import path from "path";
import { gql } from "@apollo/client";
import { Config } from "./types";

// Auto-discover GraphQL queries from queries/ directory (filename without extension used as key)
const queriesDir = path.join(__dirname, "queries");
const discoveredQueries: Record<string, string> = Object.fromEntries(
  fs
    .readdirSync(queriesDir)
    .filter((f) => f.endsWith(".graphql"))
    .map((f) => [f.replace(/\.graphql$/, ""), f]),
);

export const CONFIG: Config = {
  queries: discoveredQueries,
  cacheConfigurations: [
    {
      name: "Default",
      description: "Default ForestRun configuration",
      options: {},
    },
    {
      name: "Telemetry: Unexpected refetch",
      description: "Telemetry for unexpected refetches",
      options: { logStaleOperations: true },
    },
  ],
  observerCounts: [0, 50, 100],
  targetConfidencePercent: 99.85,
  maxSamplesPerBenchmark: 2000,
  warmupSamples: 20,
  batchSize: 200,
  reliability: { thresholdPercent: 1, maxAttempts: 5, requiredConsecutive: 2 },
};

export const QUERIES: Record<
  string,
  {
    query: any;
    response: any;
  }
> = {};
const responsesDir = path.join(__dirname, "responses");
for (const [key, filename] of Object.entries(CONFIG.queries)) {
  const source = fs.readFileSync(path.join(queriesDir, filename), "utf-8");
  const jsonPath = path.join(
    responsesDir,
    filename.replace(/\.graphql$/, ".json"),
  );

  QUERIES[key] = {
    query: gql(source),
    response: fs.existsSync(jsonPath)
      ? JSON.parse(fs.readFileSync(jsonPath, "utf-8"))
      : {},
  };
}
