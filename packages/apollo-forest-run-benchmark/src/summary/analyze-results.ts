import type { SummaryReport } from "../types";

import { analyzeSignificantChanges } from "./summary";
import {
  generateMarkdownReport,
  printSignificantChanges,
  saveMarkdownReport,
} from "../utils/logger";

export const analyzeResults = (summary: SummaryReport) => {
  const changeReport = analyzeSignificantChanges(summary);
  printSignificantChanges(changeReport);

  const markdownReport = generateMarkdownReport(changeReport);
  saveMarkdownReport(markdownReport);

  return changeReport;
};
