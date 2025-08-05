"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBenchmarks = runBenchmarks;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const client_1 = require("@apollo/client");
const ForestRun_1 = require("../../src/ForestRun");
const nice_benchmark_1 = __importDefault(require("./nice-benchmark"));
const mock_data_generator_1 = require("./mock-data-generator");
// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const result = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--help' || arg === '-h') {
            result.help = true;
        }
        else if (arg === '--confidence' || arg === '-c') {
            const nextArg = args[i + 1];
            if (nextArg && !nextArg.startsWith('-')) {
                const confidence = parseFloat(nextArg);
                if (!isNaN(confidence) && confidence > 0 && confidence <= 100) {
                    result.confidenceLevel = confidence;
                    i++; // Skip the next argument since we used it
                }
                else {
                    console.error(`Error: Invalid confidence level "${nextArg}". Must be a number between 0 and 100.`);
                    process.exit(1);
                }
            }
            else {
                console.error(`Error: --confidence requires a value.`);
                process.exit(1);
            }
        }
    }
    return result;
}
function showHelp() {
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
let config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
// Override config with command line arguments
const cliArgs = parseArgs();
if (cliArgs.help) {
    showHelp();
    process.exit(0);
}
if (cliArgs.confidenceLevel !== undefined) {
    config.confidenceLevel = cliArgs.confidenceLevel;
    console.log(`📊 Configuration:`);
    console.log(`   Confidence Level: ${config.confidenceLevel}%`);
    // Update config file to remember the setting
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`   ✅ Updated config.json with confidence level: ${config.confidenceLevel}%`);
}
// Load queries
const queries = {};
const queryStrings = {};
const queriesDir = path.join(__dirname, "queries");
Object.entries(config.queries).forEach(([key, filename]) => {
    const queryPath = path.join(queriesDir, filename);
    const queryString = fs.readFileSync(queryPath, "utf-8");
    queryStrings[key] = queryString;
    queries[key] = (0, client_1.gql)(queryString);
});
// Create ForestRun cache instance
function createCache() {
    return new ForestRun_1.ForestRun({
        maxOperationCount: config.maxOperationCount,
        resultCacheMaxSize: 0
    });
}
// Generate test data for a query
function createTestData(queryKey, iteration) {
    const queryString = queryStrings[queryKey];
    const { variables, result } = (0, mock_data_generator_1.generateQueryMockData)(queryString, {}, {
        seed: iteration,
        arrayLength: 3,
    });
    return { variables, result };
}
// Benchmark write operations
async function benchmarkWrites(queryKey) {
    const suite = new nice_benchmark_1.default(`${queryKey} - Write Operations`, config.confidenceLevel);
    suite.add("ForestRun Write", async () => {
        const cache = createCache();
        const query = queries[queryKey];
        for (let i = 0; i < config.operationsPerIteration; i++) {
            const { variables, result } = createTestData(queryKey, i);
            cache.writeQuery({ query, variables, data: result });
        }
    });
    return suite.run();
}
// Benchmark read operations
async function benchmarkReads(queryKey) {
    const suite = new nice_benchmark_1.default(`${queryKey} - Read Operations`, config.confidenceLevel);
    // Pre-populate cache
    const cache = createCache();
    const query = queries[queryKey];
    const testData = Array.from({ length: config.operationsPerIteration }, (_, i) => createTestData(queryKey, i));
    // Populate cache
    testData.forEach(({ variables, result }) => {
        cache.writeQuery({ query, variables, data: result });
    });
    suite.add("ForestRun Read", async () => {
        testData.forEach(({ variables }) => {
            cache.readQuery({ query, variables });
        });
    });
    return suite.run();
}
// Benchmark empty cache read operations (cache misses)
async function benchmarkEmptyReads(queryKey) {
    const suite = new nice_benchmark_1.default(`${queryKey} - Empty Cache Reads (Cache Miss)`, config.confidenceLevel);
    suite.add("ForestRun Empty Read", async () => {
        const cache = createCache();
        const query = queries[queryKey];
        for (let i = 0; i < config.operationsPerIteration; i++) {
            const { variables } = createTestData(queryKey, i);
            try {
                cache.readQuery({ query, variables });
            }
            catch (e) {
                // Expected - cache miss
            }
        }
    });
    return suite.run();
}
// Benchmark cache miss vs hit scenarios
async function benchmarkCacheMiss(queryKey) {
    const suite = new nice_benchmark_1.default(`${queryKey} - Cache Miss Operations`, config.confidenceLevel);
    suite.add("ForestRun Cache Miss", async () => {
        const cache = createCache();
        const query = queries[queryKey];
        // Populate some data (not the data we'll query)
        for (let i = 0; i < 50; i++) {
            const { variables, result } = createTestData(queryKey, i);
            cache.writeQuery({ query, variables, data: result });
        }
        // Try to read different data (cache miss)
        for (let i = 1000; i < 1000 + config.operationsPerIteration; i++) {
            const { variables } = createTestData(queryKey, i);
            try {
                cache.readQuery({ query, variables });
            }
            catch (e) {
                // Expected - cache miss
            }
        }
    });
    return suite.run();
}
// Benchmark cache hit scenarios
async function benchmarkCacheHit(queryKey) {
    const suite = new nice_benchmark_1.default(`${queryKey} - Cache Hit Operations`, config.confidenceLevel);
    suite.add("ForestRun Cache Hit", async () => {
        const cache = createCache();
        const query = queries[queryKey];
        // Populate cache with data we'll query
        const testData = Array.from({ length: config.operationsPerIteration }, (_, i) => createTestData(queryKey, i));
        testData.forEach(({ variables, result }) => {
            cache.writeQuery({ query, variables, data: result });
        });
        // Read the same data (cache hits)
        testData.forEach(({ variables }) => {
            cache.readQuery({ query, variables });
        });
    });
    return suite.run();
}
// Benchmark multiple observers scenario
async function benchmarkMultipleObservers(queryKey) {
    const suite = new nice_benchmark_1.default(`${queryKey} - Multiple Observers`, config.confidenceLevel);
    suite.add("ForestRun Multiple Observers", async () => {
        const cache = createCache();
        const query = queries[queryKey];
        // Simulate multiple observers watching the same queries
        const observerCount = 5;
        const { variables, result } = createTestData(queryKey, 0);
        // Write data once
        cache.writeQuery({ query, variables, data: result });
        // Simulate multiple observers reading the same data
        for (let i = 0; i < config.operationsPerIteration; i++) {
            for (let observer = 0; observer < observerCount; observer++) {
                cache.readQuery({ query, variables });
            }
        }
    });
    return suite.run();
}
async function benchmarkUpdates(queryKey) {
    const suite = new nice_benchmark_1.default(`${queryKey} - Update Operations`, config.confidenceLevel);
    suite.add("ForestRun Update", async () => {
        const cache = createCache();
        const query = queries[queryKey];
        // Write initial data
        for (let i = 0; i < config.operationsPerIteration; i++) {
            const { variables, result } = createTestData(queryKey, i);
            cache.writeQuery({ query, variables, data: result });
        }
        // Update data
        for (let i = 0; i < config.operationsPerIteration; i++) {
            const { variables, result } = createTestData(queryKey, i + 1000);
            cache.writeQuery({ query, variables, data: result });
        }
    });
    return suite.run();
}
// Main benchmark runner
async function runBenchmarks() {
    console.log("🚀 ForestRun Performance Benchmarks");
    console.log(`📊 Configuration:`);
    console.log(`   Confidence Level: ${config.confidenceLevel}%`);
    console.log("");
    const results = [];
    const queryKeys = Object.keys(config.queries);
    for (const queryKey of queryKeys) {
        console.log(`\n📊 Benchmarking: ${queryKey}`);
        const writeResults = await benchmarkWrites(queryKey);
        console.log(`  Write: ${writeResults.fastest[0]} - ${writeResults.benchmarks[0].mean.toFixed(3)}ms`);
        const readResults = await benchmarkReads(queryKey);
        console.log(`  Read:  ${readResults.fastest[0]} - ${readResults.benchmarks[0].mean.toFixed(3)}ms`);
        const updateResults = await benchmarkUpdates(queryKey);
        console.log(`  Update: ${updateResults.fastest[0]} - ${updateResults.benchmarks[0].mean.toFixed(3)}ms`);
        const emptyReadResults = await benchmarkEmptyReads(queryKey);
        console.log(`  Empty Read: ${emptyReadResults.fastest[0]} - ${emptyReadResults.benchmarks[0].mean.toFixed(3)}ms`);
        const cacheMissResults = await benchmarkCacheMiss(queryKey);
        console.log(`  Cache Miss: ${cacheMissResults.fastest[0]} - ${cacheMissResults.benchmarks[0].mean.toFixed(3)}ms`);
        const cacheHitResults = await benchmarkCacheHit(queryKey);
        console.log(`  Cache Hit: ${cacheHitResults.fastest[0]} - ${cacheHitResults.benchmarks[0].mean.toFixed(3)}ms`);
        const multipleObserversResults = await benchmarkMultipleObservers(queryKey);
        console.log(`  Multiple Observers: ${multipleObserversResults.fastest[0]} - ${multipleObserversResults.benchmarks[0].mean.toFixed(3)}ms`);
        results.push({
            queryName: queryKey,
            operations: {
                write: writeResults,
                read: readResults,
                update: updateResults,
                emptyRead: emptyReadResults,
                cacheMiss: cacheMissResults,
                cacheHit: cacheHitResults,
                multipleObservers: multipleObserversResults,
            },
        });
    }
    const report = {
        timestamp: Date.now(),
        config,
        results,
    };
    // Print summary
    console.log("\n📈 Performance Summary");
    console.log("====================");
    results.forEach(({ queryName, operations }) => {
        console.log(`${queryName}:`);
        console.log(`  Write: ${operations.write.benchmarks[0].mean.toFixed(3)}ms`);
        console.log(`  Read:  ${operations.read.benchmarks[0].mean.toFixed(3)}ms`);
        console.log(`  Update: ${operations.update.benchmarks[0].mean.toFixed(3)}ms`);
        console.log(`  Empty Read: ${operations.emptyRead.benchmarks[0].mean.toFixed(3)}ms`);
        console.log(`  Cache Miss: ${operations.cacheMiss.benchmarks[0].mean.toFixed(3)}ms`);
        console.log(`  Cache Hit: ${operations.cacheHit.benchmarks[0].mean.toFixed(3)}ms`);
        console.log(`  Multiple Observers: ${operations.multipleObservers.benchmarks[0].mean.toFixed(3)}ms`);
    });
    // Save report
    const reportPath = path.join(__dirname, `benchmark-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Report saved to: ${reportPath}`);
    return report;
}
// CLI interface
if (require.main === module) {
    runBenchmarks().catch(console.error);
}
