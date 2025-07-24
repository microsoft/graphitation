const { execSync } = require('child_process');
const path = require('path');

// Compile TypeScript first
console.log('Compiling TypeScript...');
try {
  execSync('npx tsc --build', { stdio: 'inherit', cwd: __dirname });
} catch (error) {
  console.error('TypeScript compilation failed:', error.message);
  process.exit(1);
}

// Run the benchmark
console.log('Running benchmarks...');
try {
  const benchmarkPath = path.join(__dirname, '../../lib/benchmarks/performance/index.js');
  execSync(`node ${benchmarkPath}`, { stdio: 'inherit', cwd: __dirname });
} catch (error) {
  console.error('Benchmark execution failed:', error.message);
  process.exit(1);
}