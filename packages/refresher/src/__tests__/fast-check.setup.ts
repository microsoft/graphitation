import * as fc from "fast-check";

const numRunsByScript: Readonly<Record<string, number>> = {
  test: 25,
  "test:watch": 10,
  "test:ci": 100,
  "test:stress": 1_000,
};

fc.configureGlobal({
  ...fc.readConfigureGlobal(),
  numRuns: numRunsByScript[process.env["npm_lifecycle_event"] ?? ""] ?? 25,
});
