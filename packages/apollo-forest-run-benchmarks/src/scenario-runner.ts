import { BenchmarkSuite } from "./benchmark-runner";
import type { CacheConfiguration, Scenario, OperationData } from "./types";

export function benchmarkOperation(
  operation: OperationData,
  scenario: Scenario,
  observerCount: number,
  cacheConfig: CacheConfiguration,
): number[] {
  const task = () => {
    const prepared = scenario.prepare({
      cacheConfig,
      observerCount,
      ...operation,
    });
    const start = process.hrtime.bigint();
    prepared.run();
    const end = process.hrtime.bigint();
    return Number(end - start) / 1e6; // ms
  };
  const suite = new BenchmarkSuite(task);

  return suite.run();
}
