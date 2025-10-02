import fs from "fs";
import path from "path";
import { parse } from "graphql";
import type { OperationData } from "../types";

export const OPERATIONS: Record<string, OperationData> = {};

const responsesDir = path.join(__dirname, "..", "..", "data", "responses");
const queriesDir = path.join(__dirname, "..", "..", "data", "queries");

const discoveredQueries: Record<string, string> = Object.fromEntries(
  fs.readdirSync(queriesDir).map((f) => [f.replace(/\.graphql$/, ""), f]),
);

const allResponseFiles = fs.readdirSync(responsesDir);

for (const [operationName, filename] of Object.entries(discoveredQueries)) {
  const source = fs.readFileSync(path.join(queriesDir, filename), "utf-8");

  const matchedResponses = allResponseFiles.filter((f) => {
    const base = f.replace(/\.json$/, "");
    return base === operationName || base.startsWith(operationName + "-");
  });

  const data: Record<string, unknown> = {};
  for (const respFile of matchedResponses) {
    data[respFile.replace(/\.json$/, "")] = JSON.parse(
      fs.readFileSync(path.join(responsesDir, respFile), "utf-8"),
    );
  }

  OPERATIONS[operationName] = {
    name: operationName,
    query: parse(source),
    data,
  };
}
