import os from "os";

export class SimpleWorkerPool {
  private numWorkers: number;

  constructor() {
    this.numWorkers = os.cpus().length;
  }

  async execute<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
    const chunkSize = Math.ceil(tasks.length / this.numWorkers);
    const chunks: Array<Array<() => Promise<T>>> = [];
    for (let i = 0; i < tasks.length; i += chunkSize) {
      chunks.push(tasks.slice(i, i + chunkSize));
    }
    const results = await Promise.all(
      chunks.map((chunk) => this.runChunk(chunk)),
    );
    return results.flat();
  }

  private async runChunk<T>(chunk: Array<() => Promise<T>>): Promise<T[]> {
    const out: T[] = [];
    for (const task of chunk) {
      out.push(await task());
    }
    return out;
  }
}
