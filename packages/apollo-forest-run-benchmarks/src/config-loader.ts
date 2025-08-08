// Deprecated: configuration now lives as a constant in index.ts.
// Export a no-op loader for any legacy imports.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadBenchmarkConfig(): any { throw new Error('config-loader deprecated; configuration is inline now'); }
