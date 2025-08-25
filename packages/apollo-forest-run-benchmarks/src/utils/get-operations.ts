import fs from "fs";
import path from "path";
import { parse } from "graphql";
import type { OperationData } from "../types";

export const OPERATIONS: OperationData[] = [];

const responsesDir = path.join(__dirname, "..", "data", "responses");
const queriesDir = path.join(__dirname, "..", "data", "queries");
const discoveredQueries: Record<string, string> = Object.fromEntries(
  fs.readdirSync(queriesDir).map((f) => [f.replace(/\.graphql$/, ""), f]),
);

for (const [operatioName, filename] of Object.entries(discoveredQueries)) {
  const source = fs.readFileSync(path.join(queriesDir, filename), "utf-8");
  const jsonPath = path.join(
    responsesDir,
    filename.replace(/\.graphql$/, ".json"),
  );

  OPERATIONS.push({
    name: operatioName,
    query: parse(source),
    data: JSON.parse(fs.readFileSync(jsonPath, "utf-8")),
    variables: {},
  });
}
