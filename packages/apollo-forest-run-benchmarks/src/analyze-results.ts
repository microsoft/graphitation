import type { SummaryReport } from "./reliability";
import { analyzeSignificantChanges } from "./reliability";
import {
  generateMarkdownReport,
  printSignificantChanges,
  saveMarkdownReport,
} from "./logger";

export const analyzeResults = (summary: SummaryReport) => {
  const changeReport = analyzeSignificantChanges(summary);

  // Print to console
  printSignificantChanges(changeReport);

  // Generate markdown report
  const markdownReport = generateMarkdownReport(changeReport);

  // Save markdown report
  saveMarkdownReport(markdownReport);

  return {
    changeReport,
    markdownReport,
  };
};
