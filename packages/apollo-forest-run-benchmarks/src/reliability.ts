import type { BenchmarkReport } from "./types";
import { Stats } from "./benchmark-runner";
import { CONFIG } from "./config";

export const checkResultsReliability = (
  current: BenchmarkReport,
  previous?: BenchmarkReport,
) => {
  if (!previous) {
    // First run, no previous results to compare against
    return { result: current, isStable: true };
  }
  const aggregatedResults = { ...previous };
  let isStable = true;
  for (const config of current.cacheConfigResults) {
    const prevCfg = aggregatedResults.cacheConfigResults.find(
      (c) => c.configuration.name === config.configuration.name,
    );
    for (const currentQuery of config.queryResults) {
      const prevQuery = prevCfg?.queryResults.find(
        (q) => q.queryName === currentQuery.queryName,
      );
      if (!prevQuery) continue;
      for (const opKey of Object.keys(currentQuery.operations)) {
        const curOp = currentQuery.operations[opKey];
        prevQuery.operations[opKey] = prevQuery.operations[opKey].concat(curOp);
        const prevOp = prevQuery.operations[opKey];
        const { confidence } = new Stats(prevOp);
        if (confidence < CONFIG.targetConfidencePercent) {
          isStable = false;
        }
      }
    }
  }

  return {
    result: aggregatedResults,
    isStable,
  };
};

export const getReliabilityStats = (result: BenchmarkReport) => {
  const report = { ...result } as unknown as any;
  for (const config of report.cacheConfigResults) {
    for (const query of config.queryResults) {
      for (const opKey of Object.keys(query.operations)) {
        const op = query.operations[opKey];
        const { confidence, arithmeticMean } = new Stats(op);
        query.operations[opKey] = {
          samples: op.length,
          confidence,
          mean: arithmeticMean,
        };
      }
    }
  }

  return report as BenchmarkReport;
};
