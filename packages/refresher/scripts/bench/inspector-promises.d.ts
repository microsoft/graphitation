/**
 * `node:inspector/promises` (Node 19+), as far as the garbage benchmark uses it: the
 * monorepo's `@types/node` predates it.
 */
declare module "node:inspector/promises" {
  import type { HeapProfiler } from "node:inspector";

  export class Session {
    connect(): void;
    disconnect(): void;
    post(
      method: "HeapProfiler.startSampling",
      params?: HeapProfiler.StartSamplingParameterType & {
        includeObjectsCollectedByMajorGC?: boolean;
        includeObjectsCollectedByMinorGC?: boolean;
      },
    ): Promise<void>;
    post(
      method: "HeapProfiler.stopSampling",
    ): Promise<HeapProfiler.StopSamplingReturnType>;
  }
}
