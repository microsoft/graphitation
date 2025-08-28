import fs from "fs";
import path from "path";
import { CONFIG } from "../config";
import { SignificantChange } from "../summary/summary";

export const log = {
  start() {
    console.log("🚀 Starting benchmark runs");
  },
  attempt(n: number) {
    console.log(`🔁 Attempt ${n}`);
  },
  reportSaved(path: string) {
    console.log(`💾 Report saved: ${path}`);
  },
};

export const printSignificantChanges = (changeReport: {
  sameConfig: SignificantChange[];
  baseline: SignificantChange[];
}) => {
  const { sameConfig, baseline } = changeReport;
  const totalChanges = sameConfig.length + baseline.length;

  console.log("\n" + "=".repeat(60));
  console.log("📊 BENCHMARK ANALYSIS SUMMARY");
  console.log("=".repeat(60));

  if (totalChanges === 0) {
    console.log("✅ No significant performance changes detected");
    return;
  }

  console.log(`🔍 Found ${totalChanges} significant change(s)`);
  console.log();

  // Print same config comparisons first (more important)
  if (sameConfig.length > 0) {
    console.log(
      "🎯 SAME CONFIGURATION COMPARISONS (vs baseline with same config):",
    );
    console.log(`   ${sameConfig.length} change(s) detected`);
    console.log();

    // Group by improvement/regression (considering both execution and memory)
    const sameConfigImprovements = sameConfig.filter((change) => {
      const executionImprovement = change.current.mean < change.baseline.mean;
      const memoryImprovement =
        change.current.memoryStats < change.baseline.memoryStats;
      // Consider it an improvement if either execution or memory improved (or both)
      return executionImprovement || memoryImprovement;
    });
    const sameConfigRegressions = sameConfig.filter((change) => {
      const executionRegression = change.current.mean > change.baseline.mean;
      const memoryRegression =
        change.current.memoryStats > change.baseline.memoryStats;
      const executionImprovement = change.current.mean < change.baseline.mean;
      const memoryImprovement =
        change.current.memoryStats < change.baseline.memoryStats;
      // Consider it a regression if there are regressions and no improvements
      return (
        (executionRegression || memoryRegression) &&
        !(executionImprovement || memoryImprovement)
      );
    });

    if (sameConfigImprovements.length > 0) {
      console.log("   🚀 IMPROVEMENTS:");
      sameConfigImprovements.forEach((change) => {
        const executionPercentChange = Math.abs(
          ((change.current.mean - change.baseline.mean) /
            change.baseline.mean) *
            100,
        );
        const memoryPercentChange = Math.abs(
          ((change.current.memoryStats - change.baseline.memoryStats) /
            change.baseline.memoryStats) *
            100,
        );

        console.log(
          `      ✅ ${change.benchId} - ${change.current.cacheConfig}/${change.current.cacheFactory}`,
        );

        // Check what type of improvement this is
        const hasExecutionImprovement =
          change.current.mean < change.baseline.mean;
        const hasMemoryImprovement =
          change.current.memoryStats < change.baseline.memoryStats;

        if (hasExecutionImprovement && hasMemoryImprovement) {
          console.log(
            `         ⚡ Execution: ${executionPercentChange.toFixed(
              1,
            )}% faster | 🧠 Memory: ${memoryPercentChange.toFixed(1)}% less`,
          );
        } else if (hasExecutionImprovement) {
          console.log(
            `         ⚡ Execution: ${executionPercentChange.toFixed(
              1,
            )}% faster`,
          );
        } else if (hasMemoryImprovement) {
          console.log(
            `         🧠 Memory: ${memoryPercentChange.toFixed(1)}% less`,
          );
        }

        console.log(
          `         Time: ${change.baseline.mean.toFixed(
            2,
          )}ms → ${change.current.mean.toFixed(2)}ms`,
        );
        console.log(
          `         Memory: ${change.baseline.memoryStats.toFixed(
            2,
          )} → ${change.current.memoryStats.toFixed(2)}`,
        );
        console.log();
      });
    }

    if (sameConfigRegressions.length > 0) {
      console.log("   ⚠️ REGRESSIONS:");
      sameConfigRegressions.forEach((change) => {
        const executionPercentChange =
          ((change.current.mean - change.baseline.mean) /
            change.baseline.mean) *
          100;
        const memoryPercentChange =
          ((change.current.memoryStats - change.baseline.memoryStats) /
            change.baseline.memoryStats) *
          100;

        console.log(
          `      ❌ ${change.benchId} - ${change.current.cacheConfig}/${change.current.cacheFactory}`,
        );

        // Check what type of regression this is
        const hasExecutionRegression =
          change.current.mean > change.baseline.mean;
        const hasMemoryRegression =
          change.current.memoryStats > change.baseline.memoryStats;

        if (hasExecutionRegression && hasMemoryRegression) {
          console.log(
            `         ⚡ Execution: ${executionPercentChange.toFixed(
              1,
            )}% slower | 🧠 Memory: ${memoryPercentChange.toFixed(1)}% more`,
          );
        } else if (hasExecutionRegression) {
          console.log(
            `         ⚡ Execution: ${executionPercentChange.toFixed(
              1,
            )}% slower`,
          );
        } else if (hasMemoryRegression) {
          console.log(
            `         🧠 Memory: ${memoryPercentChange.toFixed(1)}% more`,
          );
        }

        console.log(
          `         Time: ${change.baseline.mean.toFixed(
            2,
          )}ms → ${change.current.mean.toFixed(2)}ms`,
        );
        console.log(
          `         Memory: ${change.baseline.memoryStats.toFixed(
            2,
          )} → ${change.current.memoryStats.toFixed(2)}`,
        );
        console.log();
      });
    }
  }

  // Print baseline comparisons (vs default baseline)
  if (baseline.length > 0) {
    console.log("📏 BASELINE COMPARISONS (vs default baseline):");
    console.log(`   ${baseline.length} change(s) detected`);
    console.log();

    // Group by improvement/regression (considering both execution and memory)
    const baselineImprovements = baseline.filter((change) => {
      const executionImprovement = change.current.mean < change.baseline.mean;
      const memoryImprovement =
        change.current.memoryStats < change.baseline.memoryStats;
      // Consider it an improvement if either execution or memory improved (or both)
      return executionImprovement || memoryImprovement;
    });
    const baselineRegressions = baseline.filter((change) => {
      const executionRegression = change.current.mean > change.baseline.mean;
      const memoryRegression =
        change.current.memoryStats > change.baseline.memoryStats;
      const executionImprovement = change.current.mean < change.baseline.mean;
      const memoryImprovement =
        change.current.memoryStats < change.baseline.memoryStats;
      // Consider it a regression if there are regressions and no improvements
      return (
        (executionRegression || memoryRegression) &&
        !(executionImprovement || memoryImprovement)
      );
    });

    if (baselineImprovements.length > 0) {
      console.log("   🚀 IMPROVEMENTS:");
      baselineImprovements.forEach((change) => {
        const executionPercentChange = Math.abs(
          ((change.current.mean - change.baseline.mean) /
            change.baseline.mean) *
            100,
        );
        const memoryPercentChange = Math.abs(
          ((change.current.memoryStats - change.baseline.memoryStats) /
            change.baseline.memoryStats) *
            100,
        );

        console.log(
          `      ✅ ${change.benchId} - ${change.current.cacheConfig}/${change.current.cacheFactory}`,
        );

        // Check what type of improvement this is
        const hasExecutionImprovement =
          change.current.mean < change.baseline.mean;
        const hasMemoryImprovement =
          change.current.memoryStats < change.baseline.memoryStats;

        if (hasExecutionImprovement && hasMemoryImprovement) {
          console.log(
            `         ⚡ Execution: ${executionPercentChange.toFixed(
              1,
            )}% faster | 🧠 Memory: ${memoryPercentChange.toFixed(
              1,
            )}% less than default baseline`,
          );
        } else if (hasExecutionImprovement) {
          console.log(
            `         ⚡ Execution: ${executionPercentChange.toFixed(
              1,
            )}% faster than default baseline`,
          );
        } else if (hasMemoryImprovement) {
          console.log(
            `         🧠 Memory: ${memoryPercentChange.toFixed(
              1,
            )}% less than default baseline`,
          );
        }

        console.log(
          `         Time: ${change.baseline.mean.toFixed(
            2,
          )}ms → ${change.current.mean.toFixed(2)}ms`,
        );
        console.log(
          `         Memory: ${change.baseline.memoryStats.toFixed(
            2,
          )} → ${change.current.memoryStats.toFixed(2)}`,
        );
        console.log();
      });
    }

    if (baselineRegressions.length > 0) {
      console.log("   ⚠️ REGRESSIONS:");
      baselineRegressions.forEach((change) => {
        const executionPercentChange =
          ((change.current.mean - change.baseline.mean) /
            change.baseline.mean) *
          100;
        const memoryPercentChange =
          ((change.current.memoryStats - change.baseline.memoryStats) /
            change.baseline.memoryStats) *
          100;

        console.log(
          `      ❌ ${change.benchId} - ${change.current.cacheConfig}/${change.current.cacheFactory}`,
        );

        // Check what type of regression this is
        const hasExecutionRegression =
          change.current.mean > change.baseline.mean;
        const hasMemoryRegression =
          change.current.memoryStats > change.baseline.memoryStats;

        if (hasExecutionRegression && hasMemoryRegression) {
          console.log(
            `         ⚡ Execution: ${executionPercentChange.toFixed(
              1,
            )}% slower | 🧠 Memory: ${memoryPercentChange.toFixed(
              1,
            )}% more than default baseline`,
          );
        } else if (hasExecutionRegression) {
          console.log(
            `         ⚡ Execution: ${executionPercentChange.toFixed(
              1,
            )}% slower than default baseline`,
          );
        } else if (hasMemoryRegression) {
          console.log(
            `         🧠 Memory: ${memoryPercentChange.toFixed(
              1,
            )}% more than default baseline`,
          );
        }

        console.log(
          `         Time: ${change.baseline.mean.toFixed(
            2,
          )}ms → ${change.current.mean.toFixed(2)}ms`,
        );
        console.log(
          `         Memory: ${change.baseline.memoryStats.toFixed(
            2,
          )} → ${change.current.memoryStats.toFixed(2)}`,
        );
        console.log();
      });
    }
  }

  console.log("=".repeat(60));
};

export const generateMarkdownReport = (changeReport: {
  sameConfig: SignificantChange[];
  baseline: SignificantChange[];
}): string => {
  const { sameConfig, baseline } = changeReport;
  const totalChanges = sameConfig.length + baseline.length;

  let markdown = "# 📊 Benchmark Analysis Report\n\n";

  if (totalChanges === 0) {
    markdown += "✅ **No significant performance changes detected**\n\n";
    return markdown;
  }

  markdown += `🔍 Found **${totalChanges}** significant change(s)\n\n`;

  // Same Configuration Comparisons (more important)
  if (sameConfig.length > 0) {
    markdown += "## 🎯 Same Configuration Comparisons\n\n";
    markdown +=
      "*Comparing against baseline with the same cache configuration*\n\n";

    // Group by improvement/regression
    const sameConfigImprovements = sameConfig.filter((change) => {
      const executionImprovement = change.current.mean < change.baseline.mean;
      const memoryImprovement =
        change.current.memoryStats < change.baseline.memoryStats;
      return executionImprovement || memoryImprovement;
    });
    const sameConfigRegressions = sameConfig.filter((change) => {
      const executionRegression = change.current.mean > change.baseline.mean;
      const memoryRegression =
        change.current.memoryStats > change.baseline.memoryStats;
      const executionImprovement = change.current.mean < change.baseline.mean;
      const memoryImprovement =
        change.current.memoryStats < change.baseline.memoryStats;
      return (
        (executionRegression || memoryRegression) &&
        !(executionImprovement || memoryImprovement)
      );
    });

    if (sameConfigImprovements.length > 0) {
      markdown += "### 🚀 Improvements\n\n";
      markdown +=
        "| Benchmark ID | Configuration | Execution | Memory | Before (Time) | After (Time) | Before (Memory) | After (Memory) |\n";
      markdown +=
        "|--------------|---------------|-----------|--------|---------------|--------------|-----------------|----------------|\n";

      sameConfigImprovements.forEach((change) => {
        const executionPercentChange = Math.abs(
          ((change.current.mean - change.baseline.mean) /
            change.baseline.mean) *
            100,
        );
        const memoryPercentChange = Math.abs(
          ((change.current.memoryStats - change.baseline.memoryStats) /
            change.baseline.memoryStats) *
            100,
        );

        const hasExecutionImprovement =
          change.current.mean < change.baseline.mean;
        const hasMemoryImprovement =
          change.current.memoryStats < change.baseline.memoryStats;

        const executionChange = hasExecutionImprovement
          ? `⚡ -${executionPercentChange.toFixed(1)}%`
          : "";
        const memoryChange = hasMemoryImprovement
          ? `🧠 -${memoryPercentChange.toFixed(1)}%`
          : "";
        const config = `${change.current.cacheConfig}/${change.current.cacheFactory}`;

        markdown += `| ${
          change.benchId
        } | ${config} | ${executionChange} | ${memoryChange} | ${change.baseline.mean.toFixed(
          2,
        )}ms | ${change.current.mean.toFixed(
          2,
        )}ms | ${change.baseline.memoryStats.toFixed(
          2,
        )} | ${change.current.memoryStats.toFixed(2)} |\n`;
      });
      markdown += "\n";
    }

    if (sameConfigRegressions.length > 0) {
      markdown += "### ⚠️ Regressions\n\n";
      markdown +=
        "| Benchmark ID | Configuration | Execution | Memory | Before (Time) | After (Time) | Before (Memory) | After (Memory) |\n";
      markdown +=
        "|--------------|---------------|-----------|--------|---------------|--------------|-----------------|----------------|\n";

      sameConfigRegressions.forEach((change) => {
        const executionPercentChange =
          ((change.current.mean - change.baseline.mean) /
            change.baseline.mean) *
          100;
        const memoryPercentChange =
          ((change.current.memoryStats - change.baseline.memoryStats) /
            change.baseline.memoryStats) *
          100;

        const hasExecutionRegression =
          change.current.mean > change.baseline.mean;
        const hasMemoryRegression =
          change.current.memoryStats > change.baseline.memoryStats;

        const executionChange = hasExecutionRegression
          ? `⚡ +${executionPercentChange.toFixed(1)}%`
          : "";
        const memoryChange = hasMemoryRegression
          ? `🧠 +${memoryPercentChange.toFixed(1)}%`
          : "";
        const config = `${change.current.cacheConfig}/${change.current.cacheFactory}`;

        markdown += `| ${
          change.benchId
        } | ${config} | ${executionChange} | ${memoryChange} | ${change.baseline.mean.toFixed(
          2,
        )}ms | ${change.current.mean.toFixed(
          2,
        )}ms | ${change.baseline.memoryStats.toFixed(
          2,
        )} | ${change.current.memoryStats.toFixed(2)} |\n`;
      });
      markdown += "\n";
    }
  }

  // Baseline Comparisons (in expandable section)
  if (baseline.length > 0) {
    markdown += "<details>\n";
    markdown +=
      "<summary>📏 Baseline Comparisons (vs Default Baseline)</summary>\n\n";
    markdown +=
      "*Comparing against baseline factory with Default cache configuration*\n\n";

    // Group by improvement/regression
    const baselineImprovements = baseline.filter((change) => {
      const executionImprovement = change.current.mean < change.baseline.mean;
      const memoryImprovement =
        change.current.memoryStats < change.baseline.memoryStats;
      return executionImprovement || memoryImprovement;
    });
    const baselineRegressions = baseline.filter((change) => {
      const executionRegression = change.current.mean > change.baseline.mean;
      const memoryRegression =
        change.current.memoryStats > change.baseline.memoryStats;
      const executionImprovement = change.current.mean < change.baseline.mean;
      const memoryImprovement =
        change.current.memoryStats < change.baseline.memoryStats;
      return (
        (executionRegression || memoryRegression) &&
        !(executionImprovement || memoryImprovement)
      );
    });

    if (baselineImprovements.length > 0) {
      markdown += "### 🚀 Improvements vs Default Baseline\n\n";
      markdown +=
        "| Benchmark ID | Configuration | Execution | Memory | Before (Time) | After (Time) | Before (Memory) | After (Memory) |\n";
      markdown +=
        "|--------------|---------------|-----------|--------|---------------|--------------|-----------------|----------------|\n";

      baselineImprovements.forEach((change) => {
        const executionPercentChange = Math.abs(
          ((change.current.mean - change.baseline.mean) /
            change.baseline.mean) *
            100,
        );
        const memoryPercentChange = Math.abs(
          ((change.current.memoryStats - change.baseline.memoryStats) /
            change.baseline.memoryStats) *
            100,
        );

        const hasExecutionImprovement =
          change.current.mean < change.baseline.mean;
        const hasMemoryImprovement =
          change.current.memoryStats < change.baseline.memoryStats;

        const executionChange = hasExecutionImprovement
          ? `⚡ -${executionPercentChange.toFixed(1)}%`
          : "";
        const memoryChange = hasMemoryImprovement
          ? `🧠 -${memoryPercentChange.toFixed(1)}%`
          : "";
        const config = `${change.current.cacheConfig}/${change.current.cacheFactory}`;

        markdown += `| ${
          change.benchId
        } | ${config} | ${executionChange} | ${memoryChange} | ${change.baseline.mean.toFixed(
          2,
        )}ms | ${change.current.mean.toFixed(
          2,
        )}ms | ${change.baseline.memoryStats.toFixed(
          2,
        )} | ${change.current.memoryStats.toFixed(2)} |\n`;
      });
      markdown += "\n";
    }

    if (baselineRegressions.length > 0) {
      markdown += "### ⚠️ Regressions vs Default Baseline\n\n";
      markdown +=
        "| Benchmark ID | Configuration | Execution | Memory | Before (Time) | After (Time) | Before (Memory) | After (Memory) |\n";
      markdown +=
        "|--------------|---------------|-----------|--------|---------------|--------------|-----------------|----------------|\n";

      baselineRegressions.forEach((change) => {
        const executionPercentChange =
          ((change.current.mean - change.baseline.mean) /
            change.baseline.mean) *
          100;
        const memoryPercentChange =
          ((change.current.memoryStats - change.baseline.memoryStats) /
            change.baseline.memoryStats) *
          100;

        const hasExecutionRegression =
          change.current.mean > change.baseline.mean;
        const hasMemoryRegression =
          change.current.memoryStats > change.baseline.memoryStats;

        const executionChange = hasExecutionRegression
          ? `⚡ +${executionPercentChange.toFixed(1)}%`
          : "";
        const memoryChange = hasMemoryRegression
          ? `🧠 +${memoryPercentChange.toFixed(1)}%`
          : "";
        const config = `${change.current.cacheConfig}/${change.current.cacheFactory}`;

        markdown += `| ${
          change.benchId
        } | ${config} | ${executionChange} | ${memoryChange} | ${change.baseline.mean.toFixed(
          2,
        )}ms | ${change.current.mean.toFixed(
          2,
        )}ms | ${change.baseline.memoryStats.toFixed(
          2,
        )} | ${change.current.memoryStats.toFixed(2)} |\n`;
      });
      markdown += "\n";
    }

    markdown += "</details>\n\n";
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

export const saveJsonReport = (changeReport: {
  sameConfig: SignificantChange[];
  baseline: SignificantChange[];
}) => {
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
