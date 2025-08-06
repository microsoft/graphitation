import { Worker } from "worker_threads";
import * as path from "path";
import * as os from "os";

interface WorkerTask<T> {
  data: any;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

export class WorkerPool<T> {
  private workers: Worker[] = [];
  private freeWorkers: Worker[] = [];
  private tasks: WorkerTask<T>[] = [];
  private workerScript: string;

  constructor(workerScript: string, poolSize: number = os.cpus().length) {
    this.workerScript = workerScript;
    
    // Create worker pool
    for (let i = 0; i < poolSize; i++) {
      this.createWorker();
    }
  }

  private createWorker(): void {
    const worker = new Worker(this.workerScript, {
      execArgv: ['--require', 'ts-node/register']
    });

    worker.on('message', (result: T) => {
      this.freeWorkers.push(worker);
      this.processNextTask();
    });

    worker.on('error', (error: Error) => {
      // Remove failed worker and create a new one
      const index = this.workers.indexOf(worker);
      if (index !== -1) {
        this.workers.splice(index, 1);
      }
      this.createWorker();
    });

    this.workers.push(worker);
    this.freeWorkers.push(worker);
  }

  private processNextTask(): void {
    if (this.tasks.length === 0 || this.freeWorkers.length === 0) {
      return;
    }

    const task = this.tasks.shift()!;
    const worker = this.freeWorkers.shift()!;

    // Set up one-time listeners for this task
    const onMessage = (result: T) => {
      worker.off('message', onMessage);
      worker.off('error', onError);
      task.resolve(result);
      this.freeWorkers.push(worker);
      this.processNextTask();
    };

    const onError = (error: Error) => {
      worker.off('message', onMessage);
      worker.off('error', onError);
      task.reject(error);
      // Don't put worker back in free pool if it errored
      this.createWorker(); // Replace the errored worker
    };

    worker.on('message', onMessage);
    worker.on('error', onError);
    worker.postMessage(task.data);
  }

  execute(data: any): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.tasks.push({ data, resolve, reject });
      this.processNextTask();
    });
  }

  async destroy(): Promise<void> {
    await Promise.all(
      this.workers.map(worker => worker.terminate())
    );
    this.workers = [];
    this.freeWorkers = [];
  }
}