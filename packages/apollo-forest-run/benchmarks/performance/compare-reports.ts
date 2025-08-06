#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import { BenchmarkReport } from "./index";

interface ComparisonResult {
  queryName: string;
  operation: string;
  baseline: {
    mean: number;
    rme: number;
    samples: number;
    confidence: number;
  };
  current: {
    mean: number;
    rme: number;
    samples: number;
    confidence: number;
  };
  changePercent: number;
  changeDescription: string;
}

interface ComparisonSummary {
  totalQueries: number;
  totalOperations: number;
  improvements: ComparisonResult[];
  regressions: ComparisonResult[];
  noChange: ComparisonResult[];
  significantChanges: ComparisonResult[];
}

function parseArgs(): { baseline?: string; current?: string; format?: string; help?: boolean } {
  const args = process.argv.slice(2);
  const result: { baseline?: string; current?: string; format?: string; help?: boolean } = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--baseline' || arg === '-b') {
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        result.baseline = nextArg;
        i++;
      } else {
        console.error(`Error: --baseline requires a file path.`);
        process.exit(1);
      }
    } else if (arg === '--current' || arg === '-c') {
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        result.current = nextArg;
        i++;
      } else {
        console.error(`Error: --current requires a file path.`);
        process.exit(1);
      }
    } else if (arg === '--format' || arg === '-f') {
      const nextArg = args[i + 1];
      if (nextArg && ['markdown', 'json', 'text'].includes(nextArg)) {
        result.format = nextArg;
        i++;
      } else {
        console.error(`Error: --format must be one of: markdown, json, text`);
        process.exit(1);
      }
    }
  }
  
  return result;
}

function showHelp(): void {
  console.log(`
📊 ForestRun Benchmark Comparison Tool

Usage: node compare-reports.ts [options]

Options:
  --baseline, -b <file>     Path to baseline benchmark report JSON
  --current, -c <file>      Path to current benchmark report JSON
  --format, -f <format>     Output format: markdown, json, text (default: text)
  --help, -h                Show this help message

Examples:
  # Compare two reports with text output
  node compare-reports.ts -b baseline.json -c current.json
  
  # Generate markdown comparison for GitHub
  node compare-reports.ts -b baseline.json -c current.json -f markdown
  
  # Generate JSON output for programmatic use
  node compare-reports.ts -b baseline.json -c current.json -f json

Auto-detection:
  If no files specified, will automatically find the latest report as current
  and the second-latest as baseline in the current directory.
`);
}

function findLatestReports(): { baseline?: string; current?: string } {
  try {
    const files = fs.readdirSync(__dirname)
      .filter(f => f.startsWith('benchmark-report-') && f.endsWith('.json'))
      .sort((a, b) => {
        const timestampA = parseInt(a.replace('benchmark-report-', '').replace('.json', ''));
        const timestampB = parseInt(b.replace('benchmark-report-', '').replace('.json', ''));
        return timestampB - timestampA; // Sort descending (newest first)
      });
    
    if (files.length >= 2) {
      return {
        current: path.join(__dirname, files[0]),
        baseline: path.join(__dirname, files[1])
      };
    } else if (files.length === 1) {
      return {
        current: path.join(__dirname, files[0])
      };
    }
  } catch (error) {
    // Ignore errors, return empty
  }
  
  return {};
}

function loadReport(filePath: string): BenchmarkReport {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error loading report from ${filePath}:`, errorMessage);
    process.exit(1);
  }
}

function compareReports(baseline: BenchmarkReport, current: BenchmarkReport): ComparisonSummary {
  const comparisons: ComparisonResult[] = [];
  
  for (const currentResult of current.results) {
    const baselineResult = baseline.results.find(r => r.queryName === currentResult.queryName);
    
    if (!baselineResult) {
      // New query in current report - skip comparison
      continue;
    }
    
    // Compare each operation type
    const operations: Array<keyof typeof currentResult.operations> = [
      'write', 'read', 'update', 'emptyRead', 'cacheMiss', 'cacheHit', 'multipleObservers'
    ];
    
    for (const operation of operations) {
      const baselineOp = baselineResult.operations[operation];
      const currentOp = currentResult.operations[operation];
      
      if (baselineOp.results[0] && currentOp.results[0]) {
        const baselineMean = baselineOp.results[0].mean;
        const currentMean = currentOp.results[0].mean;
        const changePercent = ((currentMean - baselineMean) / baselineMean) * 100;
        
        let changeDescription: string;
        if (Math.abs(changePercent) < 5) {
          changeDescription = 'no significant change';
        } else if (changePercent < 0) {
          changeDescription = 'improvement (faster)';
        } else {
          changeDescription = 'regression (slower)';
        }
        
        comparisons.push({
          queryName: currentResult.queryName,
          operation,
          baseline: {
            mean: baselineMean,
            rme: baselineOp.results[0].rme,
            samples: baselineOp.results[0].samples,
            confidence: baselineOp.results[0].confidenceLevel
          },
          current: {
            mean: currentMean,
            rme: currentOp.results[0].rme,
            samples: currentOp.results[0].samples,
            confidence: currentOp.results[0].confidenceLevel
          },
          changePercent,
          changeDescription
        });
      }
    }
  }
  
  const improvements = comparisons.filter(c => c.changePercent < -5);
  const regressions = comparisons.filter(c => c.changePercent > 5);
  const noChange = comparisons.filter(c => Math.abs(c.changePercent) <= 5);
  const significantChanges = comparisons.filter(c => Math.abs(c.changePercent) > 10);
  
  return {
    totalQueries: current.results.length,
    totalOperations: comparisons.length,
    improvements,
    regressions,
    noChange,
    significantChanges
  };
}

function formatAsMarkdown(summary: ComparisonSummary, baseline: BenchmarkReport, current: BenchmarkReport): string {
  const lines = [
    '## 📊 ForestRun Benchmark Comparison',
    '',
    '### Summary',
    '',
    `| Metric | Count |`,
    `|--------|-------|`,
    `| Total Queries | ${summary.totalQueries} |`,
    `| Total Operations | ${summary.totalOperations} |`,
    `| Improvements (>5% faster) | ${summary.improvements.length} |`,
    `| Regressions (>5% slower) | ${summary.regressions.length} |`,
    `| No significant change (±5%) | ${summary.noChange.length} |`,
    `| Significant changes (>10%) | ${summary.significantChanges.length} |`,
    ''
  ];
  
  if (summary.improvements.length > 0) {
    lines.push('### 🏆 Improvements (Faster)', '');
    lines.push('| Query | Operation | Baseline | Current | Change |');
    lines.push('|-------|-----------|----------|---------|---------|');
    
    summary.improvements
      .sort((a, b) => a.changePercent - b.changePercent) // Most improved first
      .forEach(comp => {
        lines.push(`| ${comp.queryName} | ${comp.operation} | ${comp.baseline.mean.toFixed(3)}ms | ${comp.current.mean.toFixed(3)}ms | ${comp.changePercent.toFixed(1)}% |`);
      });
    
    lines.push('');
  }
  
  if (summary.regressions.length > 0) {
    lines.push('### 🐌 Regressions (Slower)', '');
    lines.push('| Query | Operation | Baseline | Current | Change |');
    lines.push('|-------|-----------|----------|---------|---------|');
    
    summary.regressions
      .sort((a, b) => b.changePercent - a.changePercent) // Most regressed first
      .forEach(comp => {
        lines.push(`| ${comp.queryName} | ${comp.operation} | ${comp.baseline.mean.toFixed(3)}ms | ${comp.current.mean.toFixed(3)}ms | +${comp.changePercent.toFixed(1)}% |`);
      });
    
    lines.push('');
  }
  
  lines.push('### 📈 All Results', '');
  lines.push('| Query | Operation | Baseline | Current | Change | Status |');
  lines.push('|-------|-----------|----------|---------|---------|---------|');
  
  [...summary.improvements, ...summary.regressions, ...summary.noChange]
    .sort((a, b) => a.queryName.localeCompare(b.queryName) || a.operation.localeCompare(b.operation))
    .forEach(comp => {
      const changeStr = comp.changePercent >= 0 ? `+${comp.changePercent.toFixed(1)}%` : `${comp.changePercent.toFixed(1)}%`;
      const status = comp.changePercent < -5 ? '🏆' : comp.changePercent > 5 ? '🐌' : '➡️';
      lines.push(`| ${comp.queryName} | ${comp.operation} | ${comp.baseline.mean.toFixed(3)}ms ±${comp.baseline.rme.toFixed(1)}% | ${comp.current.mean.toFixed(3)}ms ±${comp.current.rme.toFixed(1)}% | ${changeStr} | ${status} |`);
    });
  
  return lines.join('\n');
}

function formatAsText(summary: ComparisonSummary, baseline: BenchmarkReport, current: BenchmarkReport): string {
  const lines = [
    '📊 ForestRun Benchmark Comparison',
    '=' .repeat(35),
    '',
    'Summary:',
    `  Total Queries: ${summary.totalQueries}`,
    `  Total Operations: ${summary.totalOperations}`,
    `  Improvements (>5% faster): ${summary.improvements.length}`,
    `  Regressions (>5% slower): ${summary.regressions.length}`,
    `  No significant change (±5%): ${summary.noChange.length}`,
    `  Significant changes (>10%): ${summary.significantChanges.length}`,
    ''
  ];
  
  if (summary.improvements.length > 0) {
    lines.push('🏆 Improvements (Faster):');
    summary.improvements
      .sort((a, b) => a.changePercent - b.changePercent)
      .forEach(comp => {
        lines.push(`  ${comp.queryName} - ${comp.operation}: ${comp.baseline.mean.toFixed(3)}ms → ${comp.current.mean.toFixed(3)}ms (${comp.changePercent.toFixed(1)}%)`);
      });
    lines.push('');
  }
  
  if (summary.regressions.length > 0) {
    lines.push('🐌 Regressions (Slower):');
    summary.regressions
      .sort((a, b) => b.changePercent - a.changePercent)
      .forEach(comp => {
        lines.push(`  ${comp.queryName} - ${comp.operation}: ${comp.baseline.mean.toFixed(3)}ms → ${comp.current.mean.toFixed(3)}ms (+${comp.changePercent.toFixed(1)}%)`);
      });
    lines.push('');
  }
  
  return lines.join('\n');
}

function main(): void {
  const args = parseArgs();
  
  if (args.help) {
    showHelp();
    return;
  }
  
  let baselinePath = args.baseline;
  let currentPath = args.current;
  
  // Auto-detect if paths not provided
  if (!baselinePath || !currentPath) {
    const autoDetected = findLatestReports();
    baselinePath = baselinePath || autoDetected.baseline;
    currentPath = currentPath || autoDetected.current;
  }
  
  if (!baselinePath || !currentPath) {
    console.error('Error: Please specify both --baseline and --current files, or ensure at least 2 benchmark reports exist in the current directory.');
    console.error('Use --help for usage information.');
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
  const format = args.format || 'text';
  
  if (format === 'json') {
    console.log(JSON.stringify({
      baseline: {
        timestamp: baseline.timestamp,
        file: baselinePath
      },
      current: {
        timestamp: current.timestamp,
        file: currentPath
      },
      comparison
    }, null, 2));
  } else if (format === 'markdown') {
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