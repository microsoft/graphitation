import type { SignificantChange, SummaryChangeReport } from "../types";

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

const THRESHOLD_PERCENTAGE = CONFIG.reliability.stabilityThreshold * 100;

const getChangeText = (oldValue: number, newValue: number, unit: string) => {
  const percentChange = ((newValue - oldValue) / oldValue) * 100;
  const changeIcon = percentChange < 0 ? EMOJIS.good : EMOJIS.bad;

  if (Math.abs(percentChange) >= THRESHOLD_PERCENTAGE) {
    return `${changeIcon} ${oldValue.toFixed(2)} ${unit} ${
      EMOJIS.arrow
    } ${newValue.toFixed(2)} ${unit} (${percentChange.toFixed(1)}%)`;
  }

  return "";
};

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
  emptyLine() {
    console.log("");
  },
  summary: {
    headline(changesCount: number) {
      console.log("\n" + EMOJIS.equals.repeat(60));
      console.log(`${EMOJIS.chart} BENCHMARK ANALYSIS SUMMARY`);
      console.log(EMOJIS.equals.repeat(60));

      if (changesCount === 0) {
        console.log(
          `${EMOJIS.checkmark} No significant performance changes detected`,
        );
        return;
      } else {
        console.log(
          `${EMOJIS.magnifying} Found ${changesCount} significant change(s)`,
        );
      }

      log.emptyLine();
    },
    changeHeader(benchId: string, configText: string) {
      console.log(`${EMOJIS.chart} ${benchId} - ${configText}`);
    },
    change(change: SignificantChange) {
      const configName = change.current.cacheConfig;
      this.changeHeader(change.benchId, configName);
      this.metricDiff(
        change.baseline.mean,
        change.current.mean,
        "ns",
        EMOJIS.execution,
      );
      this.metricDiff(
        change.baseline.memoryStats,
        change.current.memoryStats,
        "bytes",
        EMOJIS.memory,
      );

      log.emptyLine();
    },
    metricDiff(
      oldValue: number,
      newValue: number,
      unit: string,
      icon: (typeof EMOJIS)[keyof typeof EMOJIS],
    ) {
      const percentChange = ((newValue - oldValue) / oldValue) * 100;

      if (Math.abs(percentChange) >= THRESHOLD_PERCENTAGE) {
        console.log(`   ${icon} ${getChangeText(oldValue, newValue, unit)}`);
      }
    },
  },
};

export const printSignificantChanges = (changeReport: SummaryChangeReport) => {
  const { sameConfig, baseline } = changeReport;
  const totalChanges = sameConfig.length + baseline.length;

  log.summary.headline(totalChanges);

  if (totalChanges === 0) {
    return;
  }

  if (sameConfig.length > 0) {
    console.log(
      `${EMOJIS.target} SAME CONFIGURATION COMPARISONS (current vs baseline):`,
    );
    log.emptyLine();
    sameConfig.forEach((change) => log.summary.change(change));
  }

  if (baseline.length > 0) {
    console.log(`${EMOJIS.ruler} CONFIGURATION IMPACT ANALYSIS:`);
    log.emptyLine();
    baseline.forEach((change) => log.summary.change(change));
  }

  console.log(EMOJIS.equals.repeat(60));
};

const generateMarkdownChangeRow = (change: SignificantChange): string => {
  const configName = change.current.cacheConfig;
  const executionText = getChangeText(
    change.baseline.mean,
    change.current.mean,
    "ns",
  );
  const memoryText = getChangeText(
    change.baseline.memoryStats,
    change.current.memoryStats,
    "bytes",
  );

  return `| ${change.benchId} | ${configName} | ${executionText} | ${memoryText} |\n`;
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

  if (sameConfig.length > 0) {
    markdown += `## ${EMOJIS.target} Same Configuration Comparisons\n\n`;
    markdown +=
      "*Comparing against baseline with the same cache configuration*\n\n";

    markdown += "| Benchmark ID | Configuration | Execution | Memory |\n";
    markdown += "|--------------|---------------|-----------|--------|\n";

    sameConfig.forEach((change) => {
      markdown += generateMarkdownChangeRow(change);
    });
    markdown += "\n";
  }

  if (baseline.length > 0) {
    markdown += "<details>\n";
    markdown += `<summary>${EMOJIS.ruler} Configuration Impact Analysis</summary>\n\n`;
    markdown +=
      "*How cache configuration impacts performance compared to the baseline*\n\n";

    markdown += "| Benchmark ID | Configuration | Execution | Memory |\n";
    markdown += "|--------------|---------------|-----------|--------|\n";

    baseline.forEach((change) => {
      markdown += generateMarkdownChangeRow(change);
    });
    markdown += "\n";
    markdown += "</details>\n\n";
  }

  markdown += "---\n";
  markdown += `*Threshold: ${THRESHOLD_PERCENTAGE}% change*\n`;

  return markdown;
};
