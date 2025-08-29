import type { SummaryReport } from "./summary/summary";

import { analyzeSignificantChanges } from "./summary/summary";
import {
  generateMarkdownReport,
  printSignificantChanges,
  saveMarkdownReport,
} from "./utils/logger";

export const analyzeResults = (summary: SummaryReport) => {
  const changeReport = analyzeSignificantChanges(summary);
  printSignificantChanges(changeReport);

  const markdownReport = generateMarkdownReport(changeReport);
  saveMarkdownReport(markdownReport);

  return changeReport;
};
