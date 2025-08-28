export class GarbageCollector {
  private stats: number[] = [];

  public collect(): void {
    const memoryStart = process.memoryUsage().heapUsed;
    if (global.gc) {
      global.gc();
    }
    const memoryEnd = process.memoryUsage().heapUsed;

    this.stats.push(memoryStart - memoryEnd);
  }

  public getStats() {
    return {
      runs: this.stats.length,
      totalMemoryFreed: this.stats.reduce((acc, curr) => acc + curr, 0),
    };
  }
}
