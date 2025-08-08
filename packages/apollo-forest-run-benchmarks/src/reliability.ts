import { BenchmarkReport } from "./types";

function checkResultsReliability(
  baseline: BenchmarkReport,
  current: BenchmarkReport,
  thresholdPercent: number,
): boolean {
  for (const currentCfg of current.cacheConfigResults) {
    const baseCfg = baseline.cacheConfigResults.find(
      (c) => c.configuration.name === currentCfg.configuration.name,
    );
    if (!baseCfg) continue;
    for (const currentQuery of currentCfg.queryResults) {
      const baseQuery = baseCfg.queryResults.find(
        (q) => q.queryName === currentQuery.queryName,
      );
      if (!baseQuery) continue;
      for (const opKey of Object.keys(currentQuery.operations)) {
        const baseOp = baseQuery.operations[opKey];
        const curOp = currentQuery.operations[opKey];
        if (baseOp?.results[0] && curOp?.results[0]) {
          const bMean = baseOp.results[0].mean;
          const cMean = curOp.results[0].mean;
          const delta = Math.abs(((cMean - bMean) / bMean) * 100);
          if (delta > thresholdPercent) return false;
        }
      }
    }
  }
  return true;
}

export function checkResultsReliabilityAgainstAll(
  previous: BenchmarkReport[],
  current: BenchmarkReport,
  thresholdPercent: number,
) {
  return previous.every((b) =>
    checkResultsReliability(b, current, thresholdPercent),
  );
}
