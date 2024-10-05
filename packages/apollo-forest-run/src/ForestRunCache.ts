import type {
  Cache,
  InMemoryCacheConfig,
  Reference,
  StoreObject,
} from "@apollo/client";
import type { DocumentNode } from "graphql";
import { equal } from "@wry/equality";
import type { OperationDescriptor } from "./descriptor/types";
import type {
  CacheEnv,
  DataForest,
  DataTree,
  OptimisticLayer,
  Store,
  Transaction,
} from "./cache/types";
import { ApolloCache } from "@apollo/client";
import { indexTree } from "./forest/indexTree";
import { assert } from "./jsutils/assert";
import { accumulate, deleteAccumulated } from "./jsutils/map";
import { read } from "./cache/read";
import { extract, fieldToStringKey } from "./cache/extract";
import { restore } from "./cache/restore";
import { getNodeChunks } from "./cache/draftHelpers";
import { modify } from "./cache/modify";
import {
  createOptimisticLayer,
  createStore,
  getEffectiveReadLayers,
  removeOptimisticLayers,
  resetStore,
} from "./cache/store";
import {
  getDiffDescriptor,
  resolveOperationDescriptor,
  transformDocument,
} from "./cache/descriptor";
import { write } from "./cache/write";
import { replaceTree } from "./forest/addTree";
import { identify } from "./cache/keys";
import { createCacheEnvironment } from "./cache/env";
import { CacheConfig } from "./cache/types";

/**
 * ForestRun cache aims to be an Apollo cache implementation somewhat compatible with InMemoryCache.
 *
 * InMemoryCache has a rather complex optimistic layering and transaction systems, which we need to mirror for BC
 * (do not confuse it with "optimism" memoization cache, which is a different system that we _fortunately_ don't need).
 *
 * For more context, read:
 * - https://www.apollographql.com/blog/mutations-and-optimistic-ui-in-apollo-client-517eacee8fb0
 * - https://www.apollographql.com/blog/tutorial-graphql-mutations-optimistic-ui-and-store-updates-f7b6b66bf0e2
 * - https://www.apollographql.com/docs/react/performance/optimistic-ui/
 *
 * This optimistic layering and transaction system dictates some choices in current implementation, so it is important
 * to understand it.
 *
 * Consider the following layering:
 * -- dataForest
 *   -- optimistic layer 1
 *     -- optimistic layer 2
 *
 * "dataForest" contains results coming from the server.
 * Each optimistic layer contains results of a single "optimistic" write transaction.
 *
 * - Non-optimistic "read" from "dataForest" will return `ResultTree` without any additional layers applied
 * - Optimistic "read" from "dataForest" will produce optimistic tree combined from ["dataForest", "layer1", "layer2"]
 *
 * Situation gets trickier _within_ "optimistic" write transactions. Within such transactions reads "start" not from
 * the "dataForest" layer, but from the specific "optimistic" layer:
 *
 * - Non-optimistic "read" from "layer 1" will return result tree from the "layer 1"
 * - Optimistic "read" from "layer 1" will produce optimistic tree combined from "layer1" and "layer2"
 */

const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_SET = new Set();
EMPTY_SET.add = () => {
  throw new Error("Immutable set");
};
const REFS_POOL = new Map(
  ["ROOT_QUERY", "ROOT_SUBSCRIPTION"].map((rootKey) => [
    rootKey,
    Object.freeze({ __ref: rootKey }),
  ]),
);
const getRef = (ref: string) => REFS_POOL.get(ref) ?? { __ref: ref };

export class ForestRunCache extends ApolloCache<any> {
  public rawConfig: InMemoryCacheConfig;
  private env: CacheEnv;
  private store: Store;

  private transactionStack: Transaction[] = [];
  private newWatches = new Set<Cache.WatchOptions>();

  // ApolloCompat:
  public policies = {
    rootTypenamesById: {
      ROOT_QUERY: "Query",
      ROOT_MUTATION: "Mutation",
      ROOT_SUBSCRIPTION: "Subscription",
    },
  };

  private invalidatedDiffs = new WeakSet<Cache.DiffResult<any>>();

  public constructor(public config?: CacheConfig) {
    super();
    this.env = createCacheEnvironment(config);
    this.store = createStore(this.env);
    this.rawConfig = config ?? {};
  }

  public identify(object: Reference | StoreObject): string | undefined {
    return identify(this.env, object);
  }

  public evict(options: Cache.EvictOptions): boolean {
    if ("id" in options && !options.id) {
      // ApolloCompat
      return false;
    }
    const { id = "ROOT_QUERY", fieldName, args } = options;

    // We need _any_ chunk just to get typeName, so can look even in optimistic layers
    const [firstChunk] = getNodeChunks(
      getEffectiveReadLayers(this.store, this.getActiveForest(), true),
      id,
    );
    if (!firstChunk) {
      return false;
    }
    if (fieldName) {
      const argValues = args ? new Map(Object.entries(args)) : undefined;
      const storeFieldName = fieldToStringKey(
        argValues && firstChunk.type
          ? {
              name: fieldName,
              args: argValues,
              keyArgs: this.env.keyArgs?.(
                firstChunk.type,
                fieldName,
                argValues,
              ),
            }
          : fieldName,
      );
      return this.modify({
        id: id,
        fields: { [storeFieldName]: (_, { DELETE }) => DELETE },
        optimistic: true,
      });
    }
    return this.modify({
      id: id,
      fields: (_, { DELETE }) => DELETE,
      optimistic: true,
    });
  }

  public modify(options: Cache.ModifyOptions): boolean {
    if ("id" in options && !options.id) {
      // ApolloCompat
      return false;
    }
    return this.transactionStack.length
      ? this.runModify(options)
      : this.runTransaction({
          update: () => this.runModify(options),
          optimistic: options.optimistic,
        });
  }

  private runModify(options: Cache.ModifyOptions): boolean {
    const activeTransaction = peek(this.transactionStack);
    assert(activeTransaction);
    const [dirty, affected] = modify(
      this.env,
      this.store,
      activeTransaction,
      options,
    );

    for (const operation of affected) {
      // Hack to force-notify invalidated operations even if their diff is the same, should be explicit somehow
      // TODO: remove invalidation after removing read policies and modify API
      for (const watch of this.store.watches.get(operation) ?? EMPTY_ARRAY) {
        if (watch.lastDiff) {
          this.invalidatedDiffs.add(watch.lastDiff);
        }
      }
    }
    this.updateTransaction(activeTransaction, options, affected);
    return dirty;
  }

  public write(options: Cache.WriteOptions): Reference | undefined {
    return this.transactionStack.length
      ? this.runWrite(options)
      : this.runTransaction({
          update: () => this.runWrite(options),
        });
  }

  private runWrite(options: Cache.WriteOptions): Reference | undefined {
    const transaction = peek(this.transactionStack);
    assert(transaction);
    const { incoming, affected } = write(
      this.env,
      this.store,
      transaction,
      options,
    );
    if (affected) {
      this.updateTransaction(transaction, options, affected, incoming);
    }
    return incoming.nodes.size ? getRef(incoming.rootNodeKey) : undefined;
  }

  private updateTransaction(
    transaction: Transaction,
    options: Cache.WriteOptions | Cache.ModifyOptions,
    affectedOperations: Iterable<OperationDescriptor>,
    incoming?: DataTree,
  ) {
    if (incoming) {
      transaction.writes.push({
        options: options as Cache.WriteOptions,
        tree: incoming,
      });
    }

    // Actual notification will happen on transaction completion (in batch)
    if (options.broadcast === false) {
      return;
    }
    if (transaction.affectedOperations) {
      for (const operation of affectedOperations) {
        transaction.affectedOperations.add(operation);
      }
    } else {
      transaction.affectedOperations = new Set(affectedOperations);
    }
    // Incoming operation may not have been updated, but let "watch" decide how to handle it
    if (incoming) {
      transaction.affectedOperations.add(incoming.operation);
    }

    // ApolloCompat: new watches must be notified immediately after the next write
    if (this.newWatches.size) {
      transaction.watchesToNotify ??= new Set();
      for (const watch of this.newWatches) {
        transaction.watchesToNotify.add(watch);
      }
      this.newWatches.clear();
    }
  }

  private getActiveForest(): DataForest | OptimisticLayer {
    const transaction = peek(this.transactionStack);
    return transaction?.optimisticLayer ?? this.store.dataForest;
  }

  private notifyWatches(
    rootTransaction: Transaction,
    watchesToNotify: Set<Cache.WatchOptions>,
    onWatchUpdated?: Cache.BatchOptions<any>["onWatchUpdated"],
    fromOptimisticTransaction?: boolean,
  ) {
    const stale: {
      operation: OperationDescriptor;
      diff: Cache.DiffResult<any>;
    }[] = [];
    const errors = new Map<Cache.WatchOptions, Error>();
    for (const watch of watchesToNotify) {
      try {
        const newDiff = this.diff(watch);
        // ApolloCompat: expected by QueryManager (and looks like only for watches???) :/
        if (fromOptimisticTransaction && watch.optimistic) {
          newDiff.fromOptimisticTransaction = true;
        }
        if (!newDiff.complete && watch.lastDiff?.complete) {
          stale.push({
            operation: getDiffDescriptor(this.env, this.store, watch),
            diff: newDiff,
          });
        }
        if (this.shouldNotifyWatch(watch, newDiff, onWatchUpdated)) {
          this.notifyWatch(watch, newDiff);
        }
      } catch (e) {
        errors.set(watch, e as Error);
      }
    }
    if (stale.length) {
      logStaleOperations(rootTransaction, stale);
    }
    if (errors.size) {
      const [firstError] = errors.values();
      throw firstError;
    }
  }

  private notifyWatch(watch: Cache.WatchOptions, diff: Cache.DiffResult<any>) {
    const lastDiff = watch.lastDiff;
    watch.lastDiff = diff;
    watch.callback(diff, lastDiff);
  }

  public read<T>(options: Cache.ReadOptions): T | null {
    const diff = this.diff(options);
    return diff.complete || options.returnPartialData ? diff.result : null;
  }

  public diff<TData, TVariables = any>(
    options: Cache.DiffOptions<TData, TVariables>,
  ): Cache.DiffResult<TData> {
    const activeTransaction = peek(this.transactionStack);
    const result = read<TData>(
      this.env,
      this.store,
      activeTransaction,
      options,
    );
    if (options.returnPartialData === false && result.dangling?.size) {
      const [ref] = result.dangling;
      throw new Error(`Dangling reference to missing ${ref} object`);
    }
    if (options.returnPartialData === false && result.missing) {
      throw new Error(result.missing[0].message);
    }
    return result;
  }

  public watch<TData = any, TVariables = any>(
    watch: Cache.WatchOptions<TData, TVariables>,
  ): () => void {
    const operationDescriptor = getDiffDescriptor(this.env, this.store, watch);

    if (watch.immediate /* && !this.transactionStack.length */) {
      const diff = this.diff(watch);
      if (this.shouldNotifyWatch(watch, diff)) {
        this.notifyWatch(watch, diff);
      }
    } else {
      // ApolloCompat: new watches must be notified on next transaction completion
      // (even if their corresponding operations were not affected)
      this.newWatches.add(watch);
    }

    accumulate(this.store.watches, operationDescriptor, watch);
    return () => {
      this.newWatches.delete(watch);
      deleteAccumulated(this.store.watches, operationDescriptor, watch);
    };
  }

  public restore(nodeMap: Record<string, any>): this {
    const writes = restore(this.env, nodeMap);

    this.reset();
    for (const write of writes) {
      const operation = resolveOperationDescriptor(
        this.env,
        this.store,
        write.query,
        write.variables,
        write.dataId,
      );
      const operationResult = { data: write.result ?? {} };
      const tree = indexTree(this.env, operation, operationResult);
      replaceTree(this.store.dataForest, tree);
    }
    return this;
  }

  public getStats() {
    return {
      docCount: this.store.operations.size,
      treeCount: this.store.dataForest.trees.size,
    };
  }

  public frExtract() {
    return {
      forest: this.store.dataForest.trees,
      optimisticForest: this.store.optimisticLayers,
    };
  }

  public extract(optimistic = false): StoreObject {
    const activeTransaction = peek(this.transactionStack);
    const effectiveOptimistic =
      activeTransaction?.forceOptimistic ?? optimistic;

    return extract(
      this.env,
      getEffectiveReadLayers(
        this.store,
        this.getActiveForest(),
        effectiveOptimistic,
      ),
    );
  }

  // Note: this method is necessary for Apollo test suite
  public __lookup(key: string): StoreObject {
    const result = this.extract();
    return result[key] as any;
  }

  // ApolloCompat
  public retain() {
    return 0;
  }

  public reset(options?: Cache.ResetOptions): Promise<void> {
    resetStore(this.store);

    if (options?.discardWatches) {
      this.newWatches.clear();
      this.store.watches.clear();
    }

    return Promise.resolve();
  }

  /**
   * @deprecated use batch
   */
  public performTransaction(
    update: (cache: ForestRunCache) => any,
    optimisticId?: string | null,
  ) {
    return this.runTransaction({
      update,
      optimistic: optimisticId || optimisticId !== null,
    });
  }

  public batch<T>(options: Cache.BatchOptions<this, T>): T {
    return this.runTransaction(options);
  }

  private runTransaction<T>(options: Cache.BatchOptions<this, T>): T {
    const parentTransaction = peek(this.transactionStack);
    const { update, optimistic, removeOptimistic, onWatchUpdated } = options;

    let optimisticLayer: OptimisticLayer | null;
    let forceOptimistic: boolean | null = null;
    if (typeof optimistic === "string") {
      // See a note in removeOptimisticLayer on why
      const replay = () => this.runTransaction(options);
      optimisticLayer = createOptimisticLayer(optimistic, replay);
      this.store.optimisticLayers.push(optimisticLayer);
    } else if (optimistic === false) {
      optimisticLayer = parentTransaction?.optimisticLayer ?? null;
      forceOptimistic = false;
    } else {
      optimisticLayer = parentTransaction?.optimisticLayer ?? null;
    }
    const activeTransaction: Transaction = {
      optimisticLayer,
      affectedOperations: null,
      watchesToNotify: null,
      forceOptimistic,
      writes: [],
    };
    this.transactionStack.push(activeTransaction);
    let error;
    let result: T | undefined = undefined;
    let watchesToNotify: Set<Cache.WatchOptions> | null = null;
    try {
      result = update(this);

      // This must run within transaction itself, because it runs `diff` under the hood
      // which may need to read results from the active optimistic layer
      watchesToNotify = this.collectAffectedWatches(
        activeTransaction,
        onWatchUpdated,
      );
    } catch (e) {
      error = e;
    }
    assert(activeTransaction === peek(this.transactionStack));
    this.transactionStack.pop();

    if (error) {
      // Cleanup
      if (typeof removeOptimistic === "string") {
        this.removeOptimistic(removeOptimistic);
      }
      if (typeof optimistic === "string") {
        this.removeOptimistic(optimistic);
      }
      throw error;
    }
    if (typeof removeOptimistic === "string") {
      this.removeOptimistic(removeOptimistic);
    }
    if (parentTransaction) {
      parentTransaction.watchesToNotify ??= new Set();
      for (const watch of watchesToNotify ?? EMPTY_ARRAY) {
        parentTransaction.watchesToNotify.add(watch);
      }
      parentTransaction.writes.push(...activeTransaction.writes);
      return result as T;
    }
    if (watchesToNotify) {
      this.notifyWatches(
        activeTransaction,
        watchesToNotify,
        onWatchUpdated,
        typeof optimistic === "string",
      );
    }
    return result as T;
  }

  private collectAffectedWatches(
    activeTransaction: Transaction,
    onWatchUpdated?: Cache.BatchOptions<any>["onWatchUpdated"],
  ): Set<Cache.WatchOptions> | null {
    if (!activeTransaction.affectedOperations?.size) {
      return activeTransaction.watchesToNotify ?? null;
    }
    // Note: activeTransaction.watchesToNotify may already contain watches delegated by completed nested transactions
    //   so this may not only add watches, but also remove them from accumulator (depending on onWatchUpdated callback)
    const accumulator = activeTransaction.watchesToNotify ?? new Set();
    for (const operation of activeTransaction.affectedOperations) {
      for (const watch of this.store.watches.get(operation) ?? EMPTY_ARRAY) {
        const diff = this.diff(watch);

        if (!this.shouldNotifyWatch(watch, diff, onWatchUpdated)) {
          accumulator.delete(watch);
        } else {
          accumulator.add(watch);
        }
      }
    }
    return accumulator;
  }

  private shouldNotifyWatch(
    watch: Cache.WatchOptions,
    newDiff: Cache.DiffResult<any>,
    onWatchUpdated?: Cache.BatchOptions<any>["onWatchUpdated"],
  ): boolean {
    const lastDiff = watch.lastDiff;

    // ApolloCompat:
    // Special case - identical diff, but switched from optimistic transaction to a regular one
    // We need to notify parent mutation's onQueryUpdated callback via onWatchUpdated
    // see useMutation.test.tsx "can pass onQueryUpdated to useMutation"
    if (
      lastDiff &&
      lastDiff.result == newDiff.result &&
      lastDiff.fromOptimisticTransaction !==
        newDiff.fromOptimisticTransaction &&
      onWatchUpdated &&
      onWatchUpdated.call(this, watch, newDiff, lastDiff) === false
    ) {
      return false;
    }

    // ApolloCompat:
    //   Another special case: cache.modify allows to INVALIDATE individual fields without affecting diffs.
    //   For those we should call onWatchUpdated but don't actually notify watchers 🤷‍
    if (
      lastDiff &&
      newDiff.result == lastDiff.result &&
      this.invalidatedDiffs.has(lastDiff)
    ) {
      this.invalidatedDiffs.delete(lastDiff);
      onWatchUpdated && onWatchUpdated.call(this, watch, newDiff, lastDiff);
      return false;
    }

    // Always notify when there is no "lastDiff" (first notification)
    // intentionally not strict (null == undefined)
    if (lastDiff && newDiff.result == lastDiff.result) {
      return false;
    }
    if (
      lastDiff &&
      !newDiff.complete &&
      !lastDiff.complete &&
      !watch.returnPartialData &&
      equal(lastDiff.result, newDiff.result)
    ) {
      // Already notified about partial data once
      return false;
    }

    // ApolloCompat: let transaction initiator decide
    if (
      onWatchUpdated &&
      onWatchUpdated.call(this, watch, newDiff, lastDiff) === false
    ) {
      return false;
    }
    return true;
  }

  public removeOptimistic(layerTag: string) {
    return this.transactionStack.length
      ? this.removeOptimisticLayers(layerTag)
      : this.runTransaction({
          update: () => this.removeOptimisticLayers(layerTag),
        });
  }

  private removeOptimisticLayers(layerTag: string) {
    const activeTransaction = peek(this.transactionStack);
    assert(activeTransaction);
    activeTransaction.affectedOperations ??= new Set();
    const affectedOps = removeOptimisticLayers(this, this.store, layerTag);

    for (const operation of affectedOps ?? EMPTY_ARRAY) {
      activeTransaction.affectedOperations.add(operation);
    }
  }

  public transformDocument(document: DocumentNode): DocumentNode {
    return this.env.addTypename ? transformDocument(document) : document;
  }
}

function peek<T>(stack: T[]): T | undefined {
  return stack[stack.length - 1];
}

function logStaleOperations(
  transaction: Transaction,
  stale: {
    operation: OperationDescriptor;
    diff: Cache.DiffResult<any>;
  }[],
) {
  console.log(
    `Incoming Apollo operation led to missing fields in watched operations (triggering re-fetch)\n` +
      `  Incoming operation(s):\n` +
      transaction.writes
        .map((write) => write.tree.operation.debugName)
        .join("\n") +
      `\n` +
      `  Affected operation(s):\n` +
      stale
        .map(
          (op) =>
            op.operation.debugName +
            ` (${op.diff.missing?.[0]?.message ?? "?"})`,
        )
        .join("\n"),
  );
}
