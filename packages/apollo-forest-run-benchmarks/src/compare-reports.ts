#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { BenchmarkReport } from "./types";

interface ComparisonResult {
  cacheConfig: string;
  queryName: string;
  operation: string;
  baseline: {
    mean: number;
    samples: number;
    confidence: number;
  } | null;
  current: {
    mean: number;
    samples: number;
    confidence: number;
  } | null;
  changePercent: number | null; // null => cannot compute
  changeDescription: string;
  status:
    | "improvement"
    | "regression"
    | "no-change"
    | "new"
    | "removed"
    | "n/a";
}

interface ComparisonSummary {
  totalQueries: number;
  totalOperations: number;
  improvements: ComparisonResult[];
  regressions: ComparisonResult[];
  noChange: ComparisonResult[];
  significantChanges: ComparisonResult[];
  byConfig: Record<
    string,
    {
      improvements: ComparisonResult[];
      regressions: ComparisonResult[];
      noChange: ComparisonResult[];
      significantChanges: ComparisonResult[];
    }
  >;
}

// Configure yargs with proper types and validation
const argv = yargs(hideBin(process.argv))
  .usage("📊 ForestRun Benchmark Comparison Tool\n\nUsage: $0 [options]")
  .option("baseline", {
    alias: "b",
    type: "string",
    description: "Path to baseline benchmark report JSON file",
  })
  .option("current", {
    alias: "c",
    type: "string",
    description: "Path to current benchmark report JSON file",
  })
  .option("format", {
    alias: "f",
    type: "string",
    choices: ["text", "markdown", "json"] as const,
    default: "text" as const,
    description: "Output format",
  })
  .example("$0", "Compare latest two reports automatically")
  .example("$0 -b baseline.json -c current.json", "Compare specific reports")
  .example(
    "$0 -b baseline.json -c current.json -f markdown",
    "Generate markdown for GitHub",
  )
  .example("$0 -f json", "Output JSON format for programmatic use")
  .help("h")
  .alias("h", "help")
  .epilogue(
    "Auto-detection: If no files specified, will automatically find the latest report as current and the second-latest as baseline in the current directory.",
  )
  .strict()
  .parseSync();

function findLatestReports(): { baseline?: string; current?: string } {
  try {
    const files = fs
      .readdirSync(__dirname)
      .filter((f) => f.startsWith("benchmark-report-") && f.endsWith(".json"))
      .sort((a, b) => {
        const timestampA = parseInt(
          a.replace("benchmark-report-", "").replace(".json", ""),
        );
        const timestampB = parseInt(
          b.replace("benchmark-report-", "").replace(".json", ""),
        );
        return timestampB - timestampA; // Sort descending (newest first)
      });

    if (files.length >= 2) {
      return {
        current: path.join(__dirname, files[0]),
        baseline: path.join(__dirname, files[1]),
      };
    } else if (files.length === 1) {
      return {
        current: path.join(__dirname, files[0]),
      };
    }
  } catch (error) {
    // Ignore errors, return empty
  }

  return {};
}

function loadReport(filePath: string): BenchmarkReport {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error loading report from ${filePath}:`, errorMessage);
    process.exit(1);
  }
}

function compareReports(
  baseline: BenchmarkReport,
  current: BenchmarkReport,
): ComparisonSummary {
  const comparisons: ComparisonResult[] = [];

  const allCacheConfigs = new Set<string>();
  baseline.cacheConfigResults.forEach((c) =>
    allCacheConfigs.add(c.configuration.name),
  );
  current.cacheConfigResults.forEach((c) =>
    allCacheConfigs.add(c.configuration.name),
  );

  for (const cacheConfigName of allCacheConfigs) {
    const baseCfg = baseline.cacheConfigResults.find(
      (c) => c.configuration.name === cacheConfigName,
    );
    const curCfg = current.cacheConfigResults.find(
      (c) => c.configuration.name === cacheConfigName,
    );
    const allQueryNames = new Set<string>();
    baseCfg?.queryResults.forEach((q) => allQueryNames.add(q.queryName));
    curCfg?.queryResults.forEach((q) => allQueryNames.add(q.queryName));

    for (const queryName of allQueryNames) {
      const baseQuery = baseCfg?.queryResults.find(
        (q) => q.queryName === queryName,
      );
      const curQuery = curCfg?.queryResults.find(
        (q) => q.queryName === queryName,
      );
      const opKeys = new Set<string>();
      baseQuery &&
        Object.keys(baseQuery.operations).forEach((k) => opKeys.add(k));
      curQuery &&
        Object.keys(curQuery.operations).forEach((k) => opKeys.add(k));

      for (const opKey of opKeys) {
        const baseOp: any = baseQuery?.operations[opKey];
        const curOp: any = curQuery?.operations[opKey];
        let changePercent: number | null = null;
        let changeDescription = "n/a";
        let status: ComparisonResult["status"] = "n/a";
        if (baseOp && curOp) {
          changePercent = ((curOp.mean - baseOp.mean) / baseOp.mean) * 100;
          if (Math.abs(changePercent) < 5) {
            changeDescription = "no significant change";
            status = "no-change";
          } else if (changePercent < 0) {
            changeDescription = "improvement (faster)";
            status = "improvement";
          } else {
            changeDescription = "regression (slower)";
            status = "regression";
          }
        } else if (!baseOp && curOp) {
          changeDescription = "new";
          status = "new";
        } else if (baseOp && !curOp) {
          changeDescription = "removed";
          status = "removed";
        }
        comparisons.push({
          cacheConfig: cacheConfigName,
          queryName,
          operation: opKey,
          baseline: baseOp
            ? {
                mean: baseOp.mean,
                samples: baseOp.samples,
                confidence: baseOp.confidence,
              }
            : null,
          current: curOp
            ? {
                mean: curOp.mean,
                samples: curOp.samples,
                confidence: curOp.confidence,
              }
            : null,
          changePercent,
          changeDescription,
          status,
        });
      }
    }
  }

  const improvements = comparisons.filter((c) => c.status === "improvement");
  const regressions = comparisons.filter((c) => c.status === "regression");
  const noChange = comparisons.filter((c) => c.status === "no-change");
  const significantChanges = comparisons.filter(
    (c) => c.changePercent !== null && Math.abs(c.changePercent) > 10,
  );

  const byConfig: Record<
    string,
    {
      improvements: ComparisonResult[];
      regressions: ComparisonResult[];
      noChange: ComparisonResult[];
      significantChanges: ComparisonResult[];
    }
  > = {};
  for (const cfg of Array.from(allCacheConfigs)) {
    const cfgComparisons = comparisons.filter((c) => c.cacheConfig === cfg);
    byConfig[cfg] = {
      improvements: cfgComparisons.filter((c) => c.status === "improvement"),
      regressions: cfgComparisons.filter((c) => c.status === "regression"),
      noChange: cfgComparisons.filter((c) => c.status === "no-change"),
      significantChanges: cfgComparisons.filter(
        (c) => c.changePercent !== null && Math.abs(c.changePercent) > 10,
      ),
    };
  }

  return {
    totalQueries: current.cacheConfigResults.reduce(
      (s, c) => s + c.queryResults.length,
      0,
    ),
    totalOperations: comparisons.length,
    improvements,
    regressions,
    noChange,
    significantChanges,
    byConfig,
  };
}

function formatAsMarkdown(
  summary: ComparisonSummary,
  _baseline: BenchmarkReport,
  _current: BenchmarkReport,
): string {
  const lines = [
    "## 📊 ForestRun Benchmark Comparison",
    "",
    "### Overall Summary",
    "",
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Total Queries | ${summary.totalQueries} |`,
    `| Total Operations | ${summary.totalOperations} |`,
    `| Improvements (>5% faster) | ${summary.improvements.length} |`,
    `| Regressions (>5% slower) | ${summary.regressions.length} |`,
    `| No significant change (±5%) | ${summary.noChange.length} |`,
    `| Significant changes (>10%) | ${summary.significantChanges.length} |`,
    "",
  ];

  // Add per-configuration summaries
  const configNames = Object.keys(summary.byConfig);
  if (configNames.length > 1) {
    lines.push("### Per-Configuration Summary", "");
    lines.push(
      "| Cache Config | Improvements | Regressions | No Change | Significant Changes |",
    );
    lines.push(
      "|--------------|--------------|-------------|-----------|---------------------|",
    );

    configNames.forEach((configName) => {
      const configSummary = summary.byConfig[configName];
      lines.push(
        `| ${configName} | ${configSummary.improvements.length} | ${configSummary.regressions.length} | ${configSummary.noChange.length} | ${configSummary.significantChanges.length} |`,
      );
    });
    lines.push("");
  }

  // Overall improvements
  if (summary.improvements.length > 0) {
    lines.push("### 🏆 Overall Improvements (Faster)", "");
    lines.push(
      "| Cache Config | Query | Operation | Baseline | Current | Change |",
    );
    lines.push(
      "|--------------|-------|-----------|----------|---------|---------|",
    );

    summary.improvements
      .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0)) // Most improved first
      .forEach((comp) => {
        if (!comp.baseline || !comp.current || comp.changePercent == null)
          return;
        lines.push(
          `| ${comp.cacheConfig} | ${comp.queryName} | ${
            comp.operation
          } | ${comp.baseline.mean.toFixed(3)}ms | ${comp.current.mean.toFixed(
            3,
          )}ms | ${comp.changePercent.toFixed(1)}% |`,
        );
      });

    lines.push("");
  }

  // Overall regressions
  if (summary.regressions.length > 0) {
    lines.push("### 🐌 Overall Regressions (Slower)", "");
    lines.push(
      "| Cache Config | Query | Operation | Baseline | Current | Change |",
    );
    lines.push(
      "|--------------|-------|-----------|----------|---------|---------|",
    );

    summary.regressions
      .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0)) // Most regressed first
      .forEach((comp) => {
        if (!comp.baseline || !comp.current || comp.changePercent == null)
          return;
        lines.push(
          `| ${comp.cacheConfig} | ${comp.queryName} | ${
            comp.operation
          } | ${comp.baseline.mean.toFixed(3)}ms | ${comp.current.mean.toFixed(
            3,
          )}ms | +${comp.changePercent.toFixed(1)}% |`,
        );
      });

    lines.push("");
  }

  // Per-configuration detailed results
  configNames.forEach((configName) => {
    const configSummary = summary.byConfig[configName];
    lines.push(`### 🔧 ${configName} Configuration Results`, "");

    if (configSummary.improvements.length > 0) {
      lines.push("#### 🏆 Improvements", "");
      lines.push("| Query | Operation | Baseline | Current | Change |");
      lines.push("|-------|-----------|----------|---------|---------|");

      configSummary.improvements
        .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0))
        .forEach((comp) => {
          if (!comp.baseline || !comp.current || comp.changePercent == null)
            return;
          lines.push(
            `| ${comp.queryName} | ${
              comp.operation
            } | ${comp.baseline.mean.toFixed(
              3,
            )}ms | ${comp.current.mean.toFixed(
              3,
            )}ms | ${comp.changePercent.toFixed(1)}% |`,
          );
        });
      lines.push("");
    }

    if (configSummary.regressions.length > 0) {
      lines.push("#### 🐌 Regressions", "");
      lines.push("| Query | Operation | Baseline | Current | Change |");
      lines.push("|-------|-----------|----------|---------|---------|");

      configSummary.regressions
        .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))
        .forEach((comp) => {
          if (!comp.baseline || !comp.current || comp.changePercent == null)
            return;
          lines.push(
            `| ${comp.queryName} | ${
              comp.operation
            } | ${comp.baseline.mean.toFixed(
              3,
            )}ms | ${comp.current.mean.toFixed(
              3,
            )}ms | +${comp.changePercent.toFixed(1)}% |`,
          );
        });
      lines.push("");
    }
  });

  // Overall detailed results table
  lines.push("### 📈 All Results", "");
  lines.push(
    "| Cache Config | Query | Operation | Baseline | Current | Change | Status |",
  );
  lines.push(
    "|--------------|-------|-----------|----------|---------|---------|---------|",
  );

  comparisonsSorted(summary).forEach((comp) => {
    const changeStr =
      comp.changePercent === null
        ? "-"
        : comp.changePercent >= 0
        ? `+${comp.changePercent.toFixed(1)}%`
        : `${comp.changePercent.toFixed(1)}%`;
    const statusEmoji =
      comp.status === "improvement"
        ? "🏆"
        : comp.status === "regression"
        ? "🐌"
        : comp.status === "no-change"
        ? "➡️"
        : comp.status === "new"
        ? "�"
        : comp.status === "removed"
        ? "❌"
        : "";
    lines.push(
      `| ${comp.cacheConfig} | ${comp.queryName} | ${comp.operation} | ${changeStr} | ${statusEmoji} |`,
    );
  });

  return lines.join("\n");
}

function formatAsText(
  summary: ComparisonSummary,
  _baseline: BenchmarkReport,
  _current: BenchmarkReport,
): string {
  const lines = [
    "📊 ForestRun Benchmark Comparison",
    "=".repeat(35),
    "",
    "Overall Summary:",
    `  Total Queries: ${summary.totalQueries}`,
    `  Total Operations: ${summary.totalOperations}`,
    `  Improvements (>5% faster): ${summary.improvements.length}`,
    `  Regressions (>5% slower): ${summary.regressions.length}`,
    `  No significant change (±5%): ${summary.noChange.length}`,
    `  Significant changes (>10%): ${summary.significantChanges.length}`,
    "",
  ];

  // Per-configuration summary
  const configNames = Object.keys(summary.byConfig);
  if (configNames.length > 1) {
    lines.push("Per-Configuration Summary:");
    configNames.forEach((configName) => {
      const configSummary = summary.byConfig[configName];
      lines.push(`  ${configName}:`);
      lines.push(`    Improvements: ${configSummary.improvements.length}`);
      lines.push(`    Regressions: ${configSummary.regressions.length}`);
      lines.push(`    No change: ${configSummary.noChange.length}`);
      lines.push(
        `    Significant changes: ${configSummary.significantChanges.length}`,
      );
    });
    lines.push("");
  }

  if (summary.improvements.length > 0) {
    lines.push("🏆 Overall Improvements (Faster):");
    summary.improvements
      .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0))
      .forEach((comp) => {
        if (!comp.baseline || !comp.current || comp.changePercent == null)
          return;
        lines.push(
          `  [${comp.cacheConfig}] ${comp.queryName} - ${
            comp.operation
          }: ${comp.baseline.mean.toFixed(3)}ms → ${comp.current.mean.toFixed(
            3,
          )}ms (${comp.changePercent.toFixed(1)}%)`,
        );
      });
    lines.push("");
  }

  if (summary.regressions.length > 0) {
    lines.push("🐌 Overall Regressions (Slower):");
    summary.regressions
      .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))
      .forEach((comp) => {
        if (!comp.baseline || !comp.current || comp.changePercent == null)
          return;
        lines.push(
          `  [${comp.cacheConfig}] ${comp.queryName} - ${
            comp.operation
          }: ${comp.baseline.mean.toFixed(3)}ms → ${comp.current.mean.toFixed(
            3,
          )}ms (+${comp.changePercent.toFixed(1)}%)`,
        );
      });
    lines.push("");
  }

  // Per-configuration detailed results
  configNames.forEach((configName) => {
    const configSummary = summary.byConfig[configName];
    lines.push(`🔧 ${configName} Configuration:`);

    if (configSummary.improvements.length > 0) {
      lines.push("  🏆 Improvements:");
      configSummary.improvements
        .sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0))
        .forEach((comp) => {
          if (!comp.baseline || !comp.current || comp.changePercent == null)
            return;
          lines.push(
            `    ${comp.queryName} - ${
              comp.operation
            }: ${comp.baseline.mean.toFixed(3)}ms → ${comp.current.mean.toFixed(
              3,
            )}ms (${comp.changePercent.toFixed(1)}%)`,
          );
        });
    }

    if (configSummary.regressions.length > 0) {
      lines.push("  🐌 Regressions:");
      configSummary.regressions
        .sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0))
        .forEach((comp) => {
          if (!comp.baseline || !comp.current || comp.changePercent == null)
            return;
          lines.push(
            `    ${comp.queryName} - ${
              comp.operation
            }: ${comp.baseline.mean.toFixed(3)}ms → ${comp.current.mean.toFixed(
              3,
            )}ms (+${comp.changePercent.toFixed(1)}%)`,
          );
        });
    }
    lines.push("");
  });

  return lines.join("\n");
}

function comparisonsSorted(summary: ComparisonSummary): ComparisonResult[] {
  const all = [
    ...summary.improvements,
    ...summary.regressions,
    ...summary.noChange,
  ];
  return all.sort(
    (a, b) =>
      a.cacheConfig.localeCompare(b.cacheConfig) ||
      a.queryName.localeCompare(b.queryName) ||
      a.operation.localeCompare(b.operation),
  );
}

function main(): void {
  let baselinePath = argv.baseline;
  let currentPath = argv.current;

  // Auto-detect if paths not provided
  if (!baselinePath || !currentPath) {
    const autoDetected = findLatestReports();
    baselinePath = baselinePath || autoDetected.baseline;
    currentPath = currentPath || autoDetected.current;
  }

  if (!baselinePath || !currentPath) {
    console.error(
      "Error: Please specify both --baseline and --current files, or ensure at least 2 benchmark reports exist in the current directory.",
    );
    console.error("Use --help for usage information.");
    process.exit(1);
  }

  if (!fs.existsSync(baselinePath)) {
    console.error(`Error: Baseline file not found: ${baselinePath}`);
    process.exit(1);
  }

  if (!fs.existsSync(currentPath)) {
    console.error(`Error: Current file not found: ${currentPath}`);
    process.exit(1);
  }

  const baseline = loadReport(baselinePath);
  const current = loadReport(currentPath);

  const comparison = compareReports(baseline, current);
  const format = argv.format;

  if (format === "json") {
    console.log(
      JSON.stringify(
        {
          baseline: {
            file: baselinePath,
          },
          current: {
            file: currentPath,
          },
          comparison,
        },
        null,
        2,
      ),
    );
  } else if (format === "markdown") {
    console.log(formatAsMarkdown(comparison, baseline, current));
  } else {
    console.log(formatAsText(comparison, baseline, current));
  }
}

// CLI interface
if (require.main === module) {
  main();
}

export { compareReports, ComparisonResult, ComparisonSummary };
