import { Path } from "graphql/jsutils/Path";
import { DeferUsage, GroupedFieldSet } from "./collectFields";
import {
  PendingResult,
  IncrementalResult,
  IncrementalDeferResult,
  IncrementalStreamResult,
  CompletedResult,
} from "./types";
import { pathToArray } from "./jsutils/Path";
import { PromiseOrValue } from "./jsutils/PromiseOrValue";
import { GraphQLError } from "graphql";
import { ExecutionContext } from "./executeWithoutSchema";
import { ObjMap } from "./jsutils/ObjMap";

export class DeferredExecutionManager {
  private _lastId = 0;
  private _records: Map<string, DeferredChunk> = new Map();

  public hasRecords(): boolean {
    return this._records.size > 0;
  }

  public addDeferRecord({
    label,
    path,
    parentChunkId,
    returnTypeName,
    parentResult,
    groupedFieldSet,
    nestedDefers,
  }: {
    label: string | null;
    path: Path | undefined;
    parentChunkId: string | null;
    returnTypeName: string;
    parentResult: unknown;
    groupedFieldSet: GroupedFieldSet;
    nestedDefers: ReadonlyArray<DeferUsage>;
  }) {
    const id = this._lastId.toString();
    this._lastId++;
    this._records.set(id, {
      id,
      label,
      status: "pending",
      type: "defer",
      parentChunkId,
      path,
      returnTypeName,
      parentResult,
      groupedFieldSet,
      nestedDefers,
      errors: [],
    });
  }

  // public addAsyncIteratorStreamRecord({
  //   label,
  //   path,
  //   parentChunkId,
  //   asyncIterator,
  // }: {
  //   label: string | null;
  //   path: Path | undefined;
  //   parentChunkId: string | null;
  //   asyncIterator: AsyncIterator<ObjMap<unknown>>;
  // }) {
  //   const id = this._lastId.toString();
  //   this._lastId++;
  //   this._records.set(id, {
  //     id,
  //     label,
  //     status: "promised",
  //     type: "asyncStream",
  //     parentChunkId,
  //     path,
  //     asyncIterator,
  //     errors: [],
  //     items: [],
  //   });
  // }

  // public addItemsStreamRecord({
  //   label,
  //   path,
  //   parentChunkId,
  //   promise,
  // }: {
  //   label: string | null;
  //   path: Path | undefined;
  //   parentChunkId: string | null;
  //   promise: Promise<Array<unknown>>;
  // }) {
  //   const id = this._lastId.toString();
  //   this._lastId++;
  //   this._records.set(id, {
  //     id,
  //     label,
  //     status: "pending",
  //     type: "stream",
  //     parentChunkId,
  //     path,
  //     errors: [],
  //     promise: Promise.resolve(promise),
  //     items: [],
  //   });
  // }

  public hasNext(): boolean {
    for (const record of this._records.values()) {
      if (record.status !== "complete") {
        return true;
      }
    }
    return false;
  }

  private pendingRecords(): Array<DeferredChunk> {
    return Array.from(this._records.values()).filter(
      (chunk) => chunk.status === "pending",
      // || (chunk.type === "asyncStream" && chunk.status !== "complete"),
    );
  }

  public getPending(): ReadonlyArray<PendingResult> {
    return this.pendingRecords().map(({ id, path, label }) => {
      const pending: PendingResult = { id, path: pathToArray(path) };
      if (label != null) {
        pending.label = label;
      }
      return pending;
    });
  }

  public executePending(
    exeContext: ExecutionContext,
    executor: (
      exeContext: ExecutionContext,
      parentTypeName: string,
      sourceValue: unknown,
      path: Path | undefined,
      groupedFieldSet: GroupedFieldSet,
      deferredChunkId: string | null,
    ) => PromiseOrValue<ObjMap<unknown>>,
  ) {
    this.pendingRecords().map((record) => {
      if (record.type == "defer") {
        for (const {
          label,
          groupedFieldSet,
          nestedDefers,
        } of record.nestedDefers) {
          this.addDeferRecord({
            label: label || null,
            path: record.path,
            parentChunkId: record.id,
            returnTypeName: record.returnTypeName,
            parentResult: record.parentResult,
            groupedFieldSet,
            nestedDefers,
          });
        }
        record.status = "promised";
        record.promise = Promise.resolve(
          executor(
            exeContext,
            record.returnTypeName,
            record.parentResult,
            record.path,
            record.groupedFieldSet,
            record.id,
          ),
        ).then(
          (result) => {
            record.status = "complete";
            this.addResult(record.id, result);
            return result as unknown;
          },
          (error) => {
            record.status = "complete";
            this.addError(record.id, error);
            return null;
          },
        );
        return record.promise;
      }
      // else if (record.type === "stream") {
      //   record.status = "promised";
      //   record.promise.then(
      //     (result) => {
      //       record.status = "complete";
      //       record.items = result;
      //       return result as unknown;
      //     },
      //     (error) => {
      //       record.status = "complete";
      //       this.addError(record.id, error);
      //       return null;
      //     },
      //   );
      // } else {
      //   return record.asyncIterator.next();
      // }
    });
  }

  public async waitForNext(): Promise<unknown> {
    return Promise.race(
      Array.from(this._records.values())
        .filter(({ status }) => status === "promised")
        .map((chunk) => {
          if (
            (chunk.type === "defer" || chunk.type === "stream") &&
            chunk.promise
          ) {
            return chunk.promise;
          } else {
            return Promise.resolve();
          }
        }),
    );
  }

  public drainCompleted(): [
    Array<IncrementalResult<ObjMap<unknown>, ObjMap<unknown>>>,
    Array<CompletedResult>,
  ] {
    const results: Array<IncrementalResult<ObjMap<unknown>, ObjMap<unknown>>> =
      [];
    const completeds: Array<CompletedResult> = [];
    for (const chunk of this._records.values()) {
      if (chunk.type === "defer" && chunk.status === "complete") {
        this._records.delete(chunk.id);
        const completed: CompletedResult = {
          id: chunk.id,
        };
        if (chunk.result != null) {
          const result: IncrementalDeferResult = {
            id: chunk.id,
            data: chunk.result,
            // Subpath only needed for parital deliveries
            // subPath: pathToArray(chunk.path),
          };

          if (chunk.errors.length > 0) {
            result.errors = chunk.errors;
          }
          results.push(result);
        } else {
          completed.errors = chunk.errors;
        }
        completeds.push(completed);
      }
      // else if (chunk.type === "stream") {
      //   if (chunk.status === "complete") {
      //     const completed: CompletedResult = {
      //       id: chunk.id,
      //     };
      //     if (chunk.errors && chunk.items.length === 0) {
      //       completed.errors = chunk.errors;
      //     }
      //     completeds.push(completed);
      //   }
      //   if (chunk.items.length > 0) {
      //     const result: IncrementalStreamResult<ObjMap<unknown>> = {
      //       id: chunk.id,
      //       items: chunk.items as Array<ObjMap<unknown>>,
      //       // Subpath only needed for parital deliveries
      //       // subPath: pathToArray(chunk.path),
      //     };
      //     if (chunk.errors.length > 0) {
      //       result.errors = chunk.errors;
      //     }
      //     results.push(result);
      //   }
      // }
    }
    return [results, completeds];
  }

  private addResult(id: string, result: ObjMap<unknown>) {
    const record = this._records.get(id);
    if (record) {
      if (record.type === "defer") {
        record.result = result;
      }
      // } else if (record.type === "stream") {
      //   record.items.push(result);
      // }
    }
  }

  public addError(id: string, error: GraphQLError) {
    const record = this._records.get(id);
    if (record) {
      record.errors.push(error);
    }
  }

  public removeSubsequentPayloads(
    path: Path,
    failingChunkId: string | null,
  ): void {
    const pathArray = pathToArray(path);
    for (const record of this._records.values()) {
      if (record.id === failingChunkId) {
        continue;
      }
      const recordPath = pathToArray(record.path);
      for (let i = 0; i < pathArray.length; i++) {
        if (recordPath[i] !== pathArray[i]) {
          return;
        }

        // if (record.type === "asyncStream") {
        //   record.asyncIterator.return?.().catch(() => {});
        // }
        this._records.delete(record.id);
      }
    }
  }
}

export type DeferredChunkType =
  // "asyncStream" | "stream"
  "defer";
export type DeferredChunkStatus = "pending" | "promised" | "complete";

export type DeferredChunk = DeferredDeferChunk;
// | DeferredStreamChunk
// | DeferredAsyncStreamChunk;

export interface DeferredChunkBase {
  type: DeferredChunkType;
  status: DeferredChunkStatus;
  id: string;
  label: string | null;
  path: Path | undefined;
  parentChunkId: string | null;

  errors: Array<GraphQLError>;
}

export interface DeferredDeferChunk extends DeferredChunkBase {
  type: "defer";
  promise?: Promise<unknown>;
  result?: ObjMap<unknown>;
  parentResult: unknown;
  returnTypeName: string;
  groupedFieldSet: GroupedFieldSet;
  nestedDefers: ReadonlyArray<DeferUsage>;
}

// export interface DeferredStreamChunk extends DeferredChunkBase {
//   type: "stream";
//   items: Array<unknown>;
//   promise: Promise<Array<unknown>>;
// }

// export interface DeferredAsyncStreamChunk extends DeferredChunkBase {
//   type: "asyncStream";
//   asyncIterator: AsyncIterator<unknown>;
//   items: Array<unknown>;
// }
