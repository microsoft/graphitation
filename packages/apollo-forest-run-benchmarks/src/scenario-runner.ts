import { ForestRun } from "@graphitation/apollo-forest-run";
import { BenchmarkSuite } from "./benchmark-runner";
import type { Scenario, OperationData } from "./types";

export function benchmarkOperation(
  operation: OperationData,
  scenario: Scenario,
  observerCount: number,
  cacheFactory: (config?: any) => ForestRun,
): number[] {
  const task = () => {
    const prepared = scenario.prepare({
      observerCount,
      cacheFactory,
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
