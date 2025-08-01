"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
class NiceBenchmark {
    constructor(name) {
        this.benchmarks = [];
        this.results = [];
        this.name = name;
    }
    add(name, fn) {
        this.benchmarks.push({ name, fn });
    }
    async measureFunction(name, fn, minSamples = 5, minTime = 1000) {
        const samples = [];
        const startTime = Date.now();
        // Run at least minSamples times or until minTime milliseconds have passed
        while (samples.length < minSamples || (Date.now() - startTime) < minTime) {
            const start = process.hrtime.bigint();
            await fn();
            const end = process.hrtime.bigint();
            // Convert nanoseconds to milliseconds
            const duration = Number(end - start) / 1e6;
            samples.push(duration);
            // Don't run too many samples to avoid excessive execution time
            if (samples.length >= 100)
                break;
        }
        // Calculate statistics
        const mean = samples.reduce((sum, time) => sum + time, 0) / samples.length;
        const variance = samples.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / samples.length;
        const standardDeviation = Math.sqrt(variance);
        const standardError = standardDeviation / Math.sqrt(samples.length);
        // Relative margin of error as percentage (using 95% confidence interval)
        const rme = (standardError / mean) * 100 * 1.96;
        // Min and max times
        const min = Math.min(...samples);
        const max = Math.max(...samples);
        return {
            name,
            mean,
            rme,
            samples: samples.length,
            min,
            max,
            variance,
        };
    }
    async run(options) {
        console.log(`\n=== ${this.name} ===`);
        this.results = [];
        for (const benchmark of this.benchmarks) {
            const result = await this.measureFunction(benchmark.name, benchmark.fn);
            this.results.push(result);
            // Format output to show timing instead of ops/sec
            const meanTime = result.mean.toFixed(3);
            const marginOfError = result.rme.toFixed(2);
            console.log(`${result.name}: ${meanTime}ms ±${marginOfError}% (${result.samples} runs sampled)`);
        }
        // Find fastest and slowest (by mean time - lower is faster)
        let fastest = this.results[0];
        let slowest = this.results[0];
        for (const result of this.results) {
            if (result.mean < fastest.mean)
                fastest = result;
            if (result.mean > slowest.mean)
                slowest = result;
        }
        const benchmarkResult = {
            suiteName: this.name,
            results: this.results,
            benchmarks: this.results, // Alias for backward compatibility
            timestamp: Date.now(),
            fastest: [fastest.name],
            slowest: [slowest.name],
        };
        console.log(`Fastest is ${fastest.name}`);
        return benchmarkResult;
    }
}
exports.default = NiceBenchmark;
