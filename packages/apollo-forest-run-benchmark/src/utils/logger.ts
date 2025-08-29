import type { SignificantChange, SummaryChangeReport } from "../types";

import fs from "fs";
import path from "path";
import { CONFIG } from "../config";

const EMOJIS = {
  // General
  rocket: "🚀",
  repeat: "🔁",
  floppy: "💾",
  chart: "📊",
  magnifying: "🔍",
  target: "🎯",
  ruler: "📏",
  checkmark: "✅",
  page: "📄",
  cross: "❌",

  // Performance indicators
  execution: "📈",
  memory: "🧮",
  good: "🟢",
  bad: "🔴",

  // Separators
  equals: "=",
  arrow: "→",
} as const;

export const log = {
  start() {
    console.log(`${EMOJIS.rocket} Starting benchmark runs`);
  },
  attempt(n: number) {
    console.log(`${EMOJIS.repeat} Attempt ${n}`);
  },
  reportSaved(path: string) {
    console.log(`${EMOJIS.floppy} Report saved: ${path}`);
  },

  summary: {
    start() {
      console.log("\n" + EMOJIS.equals.repeat(60));
      console.log(`${EMOJIS.chart} BENCHMARK ANALYSIS SUMMARY`);
      console.log(EMOJIS.equals.repeat(60));
    },
  },
};

const printChangeDetails = (change: SignificantChange) => {
  const executionPercentChange =
    ((change.current.mean - change.baseline.mean) / change.baseline.mean) * 100;
  const memoryPercentChange =
    ((change.current.memoryStats - change.baseline.memoryStats) /
      change.baseline.memoryStats) *
    100;

  const configText = `${change.current.cacheConfig}/${change.current.cacheFactory}`;

  console.log(`${EMOJIS.chart} ${change.benchId} - ${configText}`);

  const statsLines = [];

  // Only show execution changes if above threshold
  if (
    Math.abs(executionPercentChange) >=
    CONFIG.significantChanges.threshold * 100
  ) {
    const executionIcon = executionPercentChange < 0 ? EMOJIS.good : EMOJIS.bad;
    const executionWord = executionPercentChange < 0 ? "faster" : "slower";
    statsLines.push(
      `${EMOJIS.execution}${executionIcon} ${change.baseline.mean.toFixed(
        2,
      )}ms ${EMOJIS.arrow} ${change.current.mean.toFixed(
        2,
      )}ms ${executionWord} (${Math.abs(executionPercentChange).toFixed(1)}%)`,
    );
  }

  // Only show memory changes if above threshold
  if (
    Math.abs(memoryPercentChange) >=
    CONFIG.significantChanges.threshold * 100
  ) {
    const memoryIcon = memoryPercentChange < 0 ? EMOJIS.good : EMOJIS.bad;
    const memoryWord = memoryPercentChange < 0 ? "less" : "more";
    statsLines.push(
      `${EMOJIS.memory}${memoryIcon} ${change.baseline.memoryStats.toFixed(
        2,
      )} ${EMOJIS.arrow} ${change.current.memoryStats.toFixed(
        2,
      )} ${memoryWord} (${Math.abs(memoryPercentChange).toFixed(1)}%)`,
    );
  }

  // Print each stat on separate lines
  statsLines.forEach((line) => console.log(`   ${line}`));

  console.log();
};

export const printSignificantChanges = (changeReport: SummaryChangeReport) => {
  const { sameConfig, baseline } = changeReport;
  const totalChanges = sameConfig.length + baseline.length;

  log.summary.start();

  if (totalChanges === 0) {
    console.log(
      `${EMOJIS.checkmark} No significant performance changes detected`,
    );
    return;
  }

  console.log(
    `${EMOJIS.magnifying} Found ${totalChanges} significant change(s)`,
  );
  console.log();

  if (sameConfig.length > 0) {
    console.log(
      `${EMOJIS.target} SAME CONFIGURATION COMPARISONS (current vs baseline):`,
    );
    console.log();
    sameConfig.forEach((change) => printChangeDetails(change));
  }

  if (baseline.length > 0) {
    console.log(`${EMOJIS.ruler} CONFIGURATION IMPACT ANALYSIS:`);
    console.log();
    baseline.forEach((change) => printChangeDetails(change));
  }

  console.log(EMOJIS.equals.repeat(60));
};

const generateMarkdownChangeRow = (change: SignificantChange): string => {
  const executionPercentChange =
    ((change.current.mean - change.baseline.mean) / change.baseline.mean) * 100;
  const memoryPercentChange =
    ((change.current.memoryStats - change.baseline.memoryStats) /
      change.baseline.memoryStats) *
    100;

  const configText = change.current.cacheConfig;
  const factoryText = change.current.cacheFactory;

  // Generate execution change text
  let executionChange = "";
  if (
    Math.abs(executionPercentChange) >=
    CONFIG.significantChanges.threshold * 100
  ) {
    const executionIcon = executionPercentChange < 0 ? EMOJIS.good : EMOJIS.bad;
    const executionWord = executionPercentChange < 0 ? "faster" : "slower";
    executionChange = `${executionIcon} ${change.baseline.mean.toFixed(2)}ms ${
      EMOJIS.arrow
    } ${change.current.mean.toFixed(2)}ms ${executionWord} (${Math.abs(
      executionPercentChange,
    ).toFixed(1)}%)`;
  }

  // Generate memory change text
  let memoryChange = "";
  if (
    Math.abs(memoryPercentChange) >=
    CONFIG.significantChanges.threshold * 100
  ) {
    const memoryIcon = memoryPercentChange < 0 ? EMOJIS.good : EMOJIS.bad;
    const memoryWord = memoryPercentChange < 0 ? "less" : "more";
    memoryChange = `${memoryIcon} ${change.baseline.memoryStats.toFixed(2)} ${
      EMOJIS.arrow
    } ${change.current.memoryStats.toFixed(2)} ${memoryWord} (${Math.abs(
      memoryPercentChange,
    ).toFixed(1)}%)`;
  }

  return `| ${change.benchId} | ${configText} | ${factoryText} | ${executionChange} | ${memoryChange} |\n`;
};

export const generateMarkdownReport = (changeReport: {
  sameConfig: SignificantChange[];
  baseline: SignificantChange[];
}): string => {
  const { sameConfig, baseline } = changeReport;

  let markdown = `# ${EMOJIS.chart} Benchmark Analysis Report\n\n`;

  if (sameConfig.length === 0) {
    markdown += `${EMOJIS.checkmark} **No significant performance changes detected**\n\n`;
  } else {
    markdown += `${EMOJIS.magnifying} Found **${sameConfig.length}** significant change(s)\n\n`;
  }

  // Same Configuration Comparisons
  if (sameConfig.length > 0) {
    markdown += `## ${EMOJIS.target} Same Configuration Comparisons\n\n`;
    markdown +=
      "*Comparing against baseline with the same cache configuration*\n\n";

    markdown +=
      "| Benchmark ID | Configuration | Factory | Execution | Memory |\n";
    markdown +=
      "|--------------|---------------|---------|-----------|--------|\n";

    sameConfig.forEach((change) => {
      markdown += generateMarkdownChangeRow(change);
    });
    markdown += "\n";
  }

  // Configuration Impact Analysis (expandable) - always show if we have baseline data
  if (baseline.length > 0) {
    markdown += "<details>\n";
    markdown += `<summary>${EMOJIS.ruler} Configuration Impact Analysis</summary>\n\n`;
    markdown +=
      "*How each cache configuration performs compared to the default configuration and baseline factory*\n\n";

    markdown +=
      "| Benchmark ID | Configuration | Factory | Execution | Memory |\n";
    markdown +=
      "|--------------|---------------|---------|-----------|--------|\n";

    baseline.forEach((change) => {
      markdown += generateMarkdownChangeRow(change);
    });
    markdown += "\n";
    markdown += "</details>\n\n";
  }

  markdown += "---\n";
  markdown += `*Threshold: ${(
    CONFIG.significantChanges.threshold * 100
  ).toFixed(1)}% change*\n`;

  return markdown;
};
