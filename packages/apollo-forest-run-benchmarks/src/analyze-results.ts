import * as fs from "fs";

interface BenchmarkResult {
  cacheConfig: string;
  cacheFactory: string;
  confidence: number;
  samples: number;
  mean: number;
}

interface BenchmarkSuite {
  [testName: string]: BenchmarkResult[];
}

interface AnalysisResult {
  testName: string;
  baseline: BenchmarkResult;
  comparison: BenchmarkResult;
  percentageChange: number;
  changeType: "improvement" | "regression";
  significant: boolean;
}

const SIGNIFICANCE_THRESHOLD = 0.05; // 5%

function loadBenchmarkResults(filePath: string): BenchmarkSuite {
  const data = fs.readFileSync(filePath, "utf8");
  return JSON.parse(data);
}

function findBaseline(results: BenchmarkResult[]): BenchmarkResult | undefined {
  return results.find(
    (r) => r.cacheConfig === "Default" && r.cacheFactory === "baseline",
  );
}

function calculatePercentageChange(
  baseline: number,
  comparison: number,
): number {
  return (comparison - baseline) / baseline;
}

function analyzeResults(benchmarkSuite: BenchmarkSuite): AnalysisResult[] {
  const analyses: AnalysisResult[] = [];

  for (const [testName, results] of Object.entries(benchmarkSuite)) {
    const baseline = findBaseline(results);
    if (!baseline) {
      console.warn(`No baseline found for test: ${testName}`);
      continue;
    }

    // Compare against all other configurations
    for (const result of results) {
      if (result === baseline) continue; // Skip comparing baseline to itself

      const percentageChange = calculatePercentageChange(
        baseline.mean,
        result.mean,
      );
      const significant = Math.abs(percentageChange) >= SIGNIFICANCE_THRESHOLD;

      if (significant) {
        analyses.push({
          testName,
          baseline,
          comparison: result,
          percentageChange,
          changeType: percentageChange < 0 ? "improvement" : "regression",
          significant: true,
        });
      }
    }
  }

  return analyses;
}

function formatTime(timeInSeconds: number): string {
  if (timeInSeconds < 0.001) {
    return `${(timeInSeconds * 1000000).toFixed(1)}μs`;
  } else if (timeInSeconds < 1) {
    return `${(timeInSeconds * 1000).toFixed(2)}ms`;
  } else {
    return `${timeInSeconds.toFixed(3)}s`;
  }
}

function formatPercentage(percentage: number): string {
  const sign = percentage > 0 ? "+" : "";
  return `${sign}${(percentage * 100).toFixed(1)}%`;
}

function printAnalysis(analyses: AnalysisResult[]): void {
  if (analyses.length === 0) {
    console.log("No significant changes found (5% threshold)");
    return;
  }

  console.log("=".repeat(80));
  console.log("BENCHMARK ANALYSIS SUMMARY");
  console.log("=".repeat(80));
  console.log(`Baseline: Default cache config with baseline factory`);
  console.log(`Significance threshold: ${SIGNIFICANCE_THRESHOLD * 100}%`);
  console.log("");

  // Group by test name for better readability
  const groupedByTest = analyses.reduce((acc, analysis) => {
    if (!acc[analysis.testName]) {
      acc[analysis.testName] = [];
    }
    acc[analysis.testName].push(analysis);
    return acc;
  }, {} as Record<string, AnalysisResult[]>);

  for (const [testName, testAnalyses] of Object.entries(groupedByTest)) {
    console.log(`📊 ${testName}`);
    console.log("-".repeat(60));

    const baseline = testAnalyses[0].baseline;
    console.log(
      `   Baseline: ${formatTime(baseline.mean)} (${
        baseline.samples
      } samples, ${baseline.confidence.toFixed(1)}% confidence)`,
    );
    console.log("");

    // Sort by percentage change (improvements first, then regressions)
    testAnalyses.sort((a, b) => a.percentageChange - b.percentageChange);

    for (const analysis of testAnalyses) {
      const { comparison, percentageChange, changeType } = analysis;
      const emoji = changeType === "improvement" ? "✅" : "❌";
      const configDescription = `${comparison.cacheConfig}/${comparison.cacheFactory}`;

      console.log(`   ${emoji} ${configDescription}`);
      console.log(
        `      Time: ${formatTime(comparison.mean)} (${formatPercentage(
          percentageChange,
        )})`,
      );
      console.log(
        `      Samples: ${
          comparison.samples
        }, Confidence: ${comparison.confidence.toFixed(1)}%`,
      );
      console.log("");
    }

    console.log("");
  }

  // Summary statistics
  const improvements = analyses.filter((a) => a.changeType === "improvement");
  const regressions = analyses.filter((a) => a.changeType === "regression");

  console.log("=".repeat(80));
  console.log("SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total significant changes: ${analyses.length}`);
  console.log(`  Improvements: ${improvements.length} 🎉`);
  console.log(`  Regressions: ${regressions.length} ⚠️`);

  if (improvements.length > 0) {
    const bestImprovement = improvements.reduce((best, current) =>
      Math.abs(current.percentageChange) > Math.abs(best.percentageChange)
        ? current
        : best,
    );
    console.log(
      `  Best improvement: ${formatPercentage(
        bestImprovement.percentageChange,
      )} (${bestImprovement.testName})`,
    );
  }

  if (regressions.length > 0) {
    const worstRegression = regressions.reduce((worst, current) =>
      current.percentageChange > worst.percentageChange ? current : worst,
    );
    console.log(
      `  Worst regression: ${formatPercentage(
        worstRegression.percentageChange,
      )} (${worstRegression.testName})`,
    );
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const filePath = args[0];

  if (!filePath) {
    console.error("Usage: ts-node analyze-results.ts <benchmark-results.json>");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  try {
    const benchmarkSuite = loadBenchmarkResults(filePath);
    const analyses = analyzeResults(benchmarkSuite);
    printAnalysis(analyses);
  } catch (error) {
    console.error("Error analyzing results:", error);
    process.exit(1);
  }
}

// Allow running as script or importing as module
if (require.main === module) {
  main();
}

export { analyzeResults, loadBenchmarkResults, AnalysisResult };
