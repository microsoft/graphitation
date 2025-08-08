import { AdaptiveBenchmarkSuite } from "./benchmark-runner";
import { makeScenario } from "./scenarios";
import { CONFIG, QUERIES } from "./config";
import {
  CacheConfiguration,
  BenchmarkSuiteResult,
  OperationType,
} from "./types";
import { ForestRun } from "@graphitation/apollo-forest-run";

export async function benchmarkOperation(
  queryKey: string,
  operation: OperationType,
  observerCount: number,
  cacheConfig: CacheConfiguration,
): Promise<BenchmarkSuiteResult> {
  const scenario = makeScenario(operation, observerCount);
  const variables = {}; // could be extended per-query later
  const { response, query } = QUERIES[queryKey];
  const suite = new AdaptiveBenchmarkSuite(
    `${queryKey}-${scenario.id}-${cacheConfig.name}`,
    CONFIG,
  );
  suite.add(scenario.label, () => {
    const cache = new ForestRun(cacheConfig.options);
    const prepared = scenario.prepare({
      cache,
      query,
      variables,
      data: response,
      observerCount,
      operation,
    });
    const start = process.hrtime.bigint();
    prepared.run();
    const end = process.hrtime.bigint();
    prepared.cleanup?.();
    return Number(end - start) / 1e6; // ms
  });
  return suite.run();
}
