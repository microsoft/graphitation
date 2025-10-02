import type { SummaryReport } from "../types";

import { analyzeSignificantChanges } from "./summary";
import {
  generateMarkdownReport,
  printSignificantChanges,
} from "../utils/logger";
import { saveResultFile } from "../utils/file";

export const analyzeResults = (summary: SummaryReport) => {
  const changeReport = analyzeSignificantChanges(summary);
  const markdownReport = generateMarkdownReport(changeReport);

  printSignificantChanges(changeReport);

  saveResultFile("benchmark.md", markdownReport);
  saveResultFile("benchmark.json", JSON.stringify(summary, null, 2));

  if (process.env.CI === "true") {
    console.log("::BEGIN_BENCHMARK_REPORT::");
    console.log(markdownReport);
    console.log("::END_BENCHMARK_REPORT::");
  }
};
