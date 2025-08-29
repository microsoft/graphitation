import type { SuiteRawResult, SuiteResult } from "../types";

import { BaseStats } from "../utils/stats";
import { CONFIG } from "../config";
import { mergeSuites } from "../utils/merge";

export const isReliable = (
  current: SuiteRawResult,
  previousRuns: SuiteRawResult[] = [],
): boolean => {
  const mergedSuites = mergeSuites(...previousRuns, current);
  const benchIds = Object.keys(mergedSuites) as (keyof SuiteResult)[];

  let isReliable = true;

  for (const benchId of benchIds) {
    for (const samples of mergedSuites[benchId]) {
      const { confidence: memoryConfidence } = new BaseStats(
        samples.memorySamples,
      );
      const { confidence: executionConfidence } = new BaseStats(
        samples.executionSamples,
      );

      if (
        executionConfidence < CONFIG.targetConfidencePercent ||
        memoryConfidence < CONFIG.targetConfidencePercent
      ) {
        isReliable = false;
        break;
      }
    }
  }

  return isReliable;
};
