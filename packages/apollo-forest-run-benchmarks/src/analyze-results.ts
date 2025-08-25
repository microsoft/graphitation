import type { SummaryReport } from "./reliability";
import { analyzeSignificantChanges } from "./reliability";
import {
  generateMarkdownReport,
  printSignificantChanges,
  saveMarkdownReport,
} from "./logger";

export const analyzeResults = (summary: SummaryReport) => {
  const changeReport = analyzeSignificantChanges(summary);
  printSignificantChanges(changeReport);

  const markdownReport = generateMarkdownReport(changeReport);
  saveMarkdownReport(markdownReport);

  return {
    changeReport,
    markdownReport,
  };
};
