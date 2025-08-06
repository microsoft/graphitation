import * as fs from "fs";
import * as path from "path";
import { BenchmarkSuiteResult } from "./nice-benchmark";
import { WorkerPool } from "./worker-pool";

interface BenchmarkConfig {
  iterations: number;
  operationsPerIteration: number;
  confidenceLevel: number;
  queries: Record<string, string>;
}

interface BenchmarkReport {
  config: BenchmarkConfig;
  results: {
    queryName: string;
    operations: {
      write: BenchmarkSuiteResult;
      read: BenchmarkSuiteResult;
      update: BenchmarkSuiteResult;
      emptyRead: BenchmarkSuiteResult;
      cacheMiss: BenchmarkSuiteResult;
      cacheHit: BenchmarkSuiteResult;
      multipleObservers: BenchmarkSuiteResult;
    };
  }[];
}

// Parse command line arguments
function parseArgs(): { confidenceLevel?: number; help?: boolean } {
  const args = process.argv.slice(2);
  const result: { confidenceLevel?: number; help?: boolean } = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--confidence' || arg === '-c') {
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('-')) {
        const confidence = parseFloat(nextArg);
        if (!isNaN(confidence) && confidence > 0 && confidence <= 100) {
          result.confidenceLevel = confidence;
          i++; // Skip the next argument since we used it
        } else {
          console.error(`Error: Invalid confidence level "${nextArg}". Must be a number between 0 and 100.`);
          process.exit(1);
        }
      } else {
        console.error(`Error: --confidence requires a value.`);
        process.exit(1);
      }
    }
  }
  
  return result;
}

function showHelp(): void {
  console.log(`
🚀 ForestRun Performance Benchmarks

Usage: yarn benchmark [options]

Options:
  --confidence, -c <level>  Set confidence level (90, 95, 99, 99.9)
                           Default: 95
  --help, -h               Show this help message

Examples:
  yarn benchmark                    # Use default 95% confidence
  yarn benchmark --confidence 99   # Use 99% confidence (high precision)
  yarn benchmark -c 90             # Use 90% confidence (faster)

Available Confidence Levels:
  90%   → z = 1.645 (faster benchmarks, good precision)
  95%   → z = 1.96  (default, balanced precision/speed)
  99%   → z = 2.576 (high precision, longer benchmarks)
  99.9% → z = 3.291 (maximum precision, research-quality)
`);
}

// Load configuration
const configPath = path.join(__dirname, "config.json");
let config: BenchmarkConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

// Override config with command line arguments if provided
const cliArgs = parseArgs();

if (cliArgs.help) {
  showHelp();
  process.exit(0);
}

// CLI args only override for this run, don't save to config
if (cliArgs.confidenceLevel !== undefined) {
  config.confidenceLevel = cliArgs.confidenceLevel;
}

// Load queries
const queryStrings: Record<string, string> = {};
const queriesDir = path.join(__dirname, "queries");

Object.entries(config.queries).forEach(([key, filename]) => {
  const queryPath = path.join(queriesDir, filename);
  const queryString = fs.readFileSync(queryPath, "utf-8");
  queryStrings[key] = queryString;
});

// Main benchmark runner with true multi-CPU parallelization using worker threads
async function runBenchmarks(): Promise<BenchmarkReport> {
  console.log("🚀 ForestRun Performance Benchmarks");
  console.log(`📊 Configuration:`);
  console.log(`   Confidence Level: ${config.confidenceLevel}%`);
  console.log("");
  
  const queryKeys = Object.keys(config.queries);
  const operations = ['write', 'read', 'update', 'emptyRead', 'cacheMiss', 'cacheHit', 'multipleObservers'];
  
  // Create worker pool for true parallel execution across CPU cores
  const workerScript = path.join(__dirname, 'benchmark-worker.ts');
  const workerPool = new WorkerPool<BenchmarkSuiteResult>(workerScript);
  
  try {
    // Create all benchmark tasks
    const benchmarkTasks: Promise<{ queryKey: string; operation: string; result: BenchmarkSuiteResult }>[] = [];
    
    for (const queryKey of queryKeys) {
      for (const operation of operations) {
        const task = workerPool.execute({
          queryKey,
          queryString: queryStrings[queryKey],
          operation,
          config: {
            iterations: config.iterations,
            operationsPerIteration: config.operationsPerIteration,
            confidenceLevel: config.confidenceLevel
          }
        }).then(result => ({
          queryKey,
          operation,
          result
        }));
        
        benchmarkTasks.push(task);
      }
    }
    
    // Execute all benchmarks in parallel across multiple CPU cores
    const benchmarkResults = await Promise.all(benchmarkTasks);
    
    // Group results by query
    const results = queryKeys.map(queryKey => {
      const queryResults = benchmarkResults.filter(r => r.queryKey === queryKey);
      
      return {
        queryName: queryKey,
        operations: {
          write: queryResults.find(r => r.operation === 'write')!.result,
          read: queryResults.find(r => r.operation === 'read')!.result,
          update: queryResults.find(r => r.operation === 'update')!.result,
          emptyRead: queryResults.find(r => r.operation === 'emptyRead')!.result,
          cacheMiss: queryResults.find(r => r.operation === 'cacheMiss')!.result,
          cacheHit: queryResults.find(r => r.operation === 'cacheHit')!.result,
          multipleObservers: queryResults.find(r => r.operation === 'multipleObservers')!.result,
        },
      };
    });
    
    const report: BenchmarkReport = {
      config,
      results,
    };
    
    // Print summary
    console.log("\n📈 Performance Summary");
    console.log("====================");
    results.forEach(({ queryName, operations }) => {
      console.log(`${queryName}:`);
      console.log(`  Write: ${operations.write.results[0].mean.toFixed(3)}ms ±${operations.write.results[0].rme.toFixed(2)}% (${operations.write.results[0].confidence.toFixed(1)}% confidence)`);
      console.log(`  Read:  ${operations.read.results[0].mean.toFixed(3)}ms ±${operations.read.results[0].rme.toFixed(2)}% (${operations.read.results[0].confidence.toFixed(1)}% confidence)`);
      console.log(`  Update: ${operations.update.results[0].mean.toFixed(3)}ms ±${operations.update.results[0].rme.toFixed(2)}% (${operations.update.results[0].confidence.toFixed(1)}% confidence)`);
      console.log(`  Empty Read: ${operations.emptyRead.results[0].mean.toFixed(3)}ms ±${operations.emptyRead.results[0].rme.toFixed(2)}% (${operations.emptyRead.results[0].confidence.toFixed(1)}% confidence)`);
      console.log(`  Cache Miss: ${operations.cacheMiss.results[0].mean.toFixed(3)}ms ±${operations.cacheMiss.results[0].rme.toFixed(2)}% (${operations.cacheMiss.results[0].confidence.toFixed(1)}% confidence)`);
      console.log(`  Cache Hit: ${operations.cacheHit.results[0].mean.toFixed(3)}ms ±${operations.cacheHit.results[0].rme.toFixed(2)}% (${operations.cacheHit.results[0].confidence.toFixed(1)}% confidence)`);
      console.log(`  Multiple Observers: ${operations.multipleObservers.results[0].mean.toFixed(3)}ms ±${operations.multipleObservers.results[0].rme.toFixed(2)}% (${operations.multipleObservers.results[0].confidence.toFixed(1)}% confidence)`);
    });
    
    // Save report
    const reportPath = path.join(__dirname, `benchmark-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Report saved to: ${reportPath}`);
    
    return report;
  } finally {
    // Clean up worker pool
    await workerPool.destroy();
  }
}

// CLI interface
if (require.main === module) {
  runBenchmarks().catch(console.error);
}

export { runBenchmarks };
export type { BenchmarkReport };