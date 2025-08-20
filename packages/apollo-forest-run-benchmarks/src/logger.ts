import fs from "fs";
import path from "path";
import { getSummary, analyzeSignificantChanges } from "./reliability";
import type {
  ChangeReport,
  SignificantChange,
  SummaryReport,
} from "./reliability";
import { CONFIG } from "./config";

export const log = {
  start() {
    console.log("🚀 Starting benchmark runs");
  },
  attempt(n: number) {
    console.log(`🔁 Attempt ${n}`);
  },
  stable(cur: number, req: number) {
    console.log(`✅ Stable (${cur}/${req})`);
  },
  variation() {
    console.log("⚠️ Variation detected – running more tests");
  },
  aggregated(runs: number, cfgs: number) {
    console.log(
      `📊 Aggregated ${runs} run(s) across ${cfgs} cache configuration(s)`,
    );
  },
  reportSaved(path: string) {
    console.log(`💾 Report saved: ${path}`);
  },
  noResults() {
    console.log("❌ No results to report");
  },
};

export const printResult = (results: any) => {
  if (!results || (Array.isArray(results) && results.length === 0)) {
    log.noResults();
    return;
  }

  const summary = getSummary(results);
  const changeReport = analyzeSignificantChanges(summary);

  printSignificantChanges(changeReport);

  const markdownReport = generateMarkdownReport(changeReport);
  saveMarkdownReport(markdownReport);
  saveJsonReport(changeReport);
};

export const printSignificantChanges = (changeReport: ChangeReport) => {
  const { significantChanges, totalScenarios, changedScenarios } = changeReport;

  console.log("\n" + "=".repeat(60));
  console.log("📊 BENCHMARK ANALYSIS SUMMARY");
  console.log("=".repeat(60));

  if (significantChanges.length === 0) {
    console.log("✅ No significant performance changes detected");
    console.log(`   Analyzed ${totalScenarios} scenario(s)`);
    return;
  }

  console.log(
    `🔍 Found ${significantChanges.length} significant change(s) across ${changedScenarios}/${totalScenarios} scenario(s)`,
  );
  console.log();

  // Group changes by improvement/regression
  const improvements = significantChanges.filter(
    (change) => change.isImprovement,
  );
  const regressions = significantChanges.filter(
    (change) => !change.isImprovement,
  );

  if (improvements.length > 0) {
    console.log("🚀 PERFORMANCE IMPROVEMENTS:");
    improvements.forEach((change) => {
      const percentStr = (Math.abs(change.percentChange) * 100).toFixed(1);
      console.log(
        `   ✅ ${change.operationName} (${change.cacheConfig}/${change.cacheFactory})`,
      );
      console.log(`      ${change.scenarioName}: ${percentStr}% faster`);
      console.log(
        `      ${change.baselineMean.toFixed(
          2,
        )}ms → ${change.currentMean.toFixed(2)}ms`,
      );
      console.log();
    });
  }

  if (regressions.length > 0) {
    console.log("⚠️ PERFORMANCE REGRESSIONS:");
    regressions.forEach((change) => {
      const percentStr = (change.percentChange * 100).toFixed(1);
      console.log(
        `   ❌ ${change.operationName} (${change.cacheConfig}/${change.cacheFactory})`,
      );
      console.log(`      ${change.scenarioName}: ${percentStr}% slower`);
      console.log(
        `      ${change.baselineMean.toFixed(
          2,
        )}ms → ${change.currentMean.toFixed(2)}ms`,
      );
      console.log();
    });
  }

  console.log("=".repeat(60));
};

export const generateMarkdownReport = (changeReport: ChangeReport): string => {
  const { significantChanges, totalScenarios, changedScenarios } = changeReport;

  let markdown = "# 📊 Benchmark Analysis Report\n\n";

  if (significantChanges.length === 0) {
    markdown += "✅ **No significant performance changes detected**\n\n";
    markdown += `Analyzed ${totalScenarios} scenario(s)\n`;
    return markdown;
  }

  markdown += `🔍 Found **${significantChanges.length}** significant change(s) across **${changedScenarios}/${totalScenarios}** scenario(s)\n\n`;

  // Group changes by improvement/regression
  const improvements = significantChanges.filter(
    (change) => change.isImprovement,
  );
  const regressions = significantChanges.filter(
    (change) => !change.isImprovement,
  );

  if (improvements.length > 0) {
    markdown += "## 🚀 Performance Improvements\n\n";
    markdown +=
      "| Operation | Configuration | Scenario | Improvement | Before | After |\n";
    markdown +=
      "|-----------|---------------|----------|-------------|--------|-------|\n";

    improvements.forEach((change) => {
      const percentStr = (Math.abs(change.percentChange) * 100).toFixed(1);
      const config = `${change.cacheConfig}/${change.cacheFactory}`;
      markdown += `| ${change.operationName} | ${config} | ${
        change.scenarioName
      } | **${percentStr}%** | ${change.baselineMean.toFixed(
        2,
      )}ms | ${change.currentMean.toFixed(2)}ms |\n`;
    });
    markdown += "\n";
  }

  if (regressions.length > 0) {
    markdown += "## ⚠️ Performance Regressions\n\n";
    markdown +=
      "| Operation | Configuration | Scenario | Regression | Before | After |\n";
    markdown +=
      "|-----------|---------------|----------|------------|--------|-------|\n";

    regressions.forEach((change) => {
      const percentStr = (change.percentChange * 100).toFixed(1);
      const config = `${change.cacheConfig}/${change.cacheFactory}`;
      markdown += `| ${change.operationName} | ${config} | ${
        change.scenarioName
      } | **+${percentStr}%** | ${change.baselineMean.toFixed(
        2,
      )}ms | ${change.currentMean.toFixed(2)}ms |\n`;
    });
    markdown += "\n";
  }

  markdown += "---\n";
  markdown += `*Threshold: ${(
    CONFIG.significantChanges.threshold * 100
  ).toFixed(1)}% change*\n`;

  return markdown;
};

export const saveMarkdownReport = (markdownReport: string) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `benchmark-analysis-${timestamp}.md`;
  const filePath = path.resolve(filename);

  try {
    fs.writeFileSync(filePath, markdownReport);
    console.log(`📄 Markdown report saved: ${filePath}`);
  } catch (error) {
    console.error(`❌ Failed to save markdown report: ${error}`);
  }
};

export const saveJsonReport = (changeReport: ChangeReport) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `benchmark-analysis-${timestamp}.json`;
  const filePath = path.resolve(filename);

  try {
    fs.writeFileSync(filePath, JSON.stringify(changeReport, null, 2));
    console.log(`📄 JSON report saved: ${filePath}`);
  } catch (error) {
    console.error(`❌ Failed to save JSON report: ${error}`);
  }
};
