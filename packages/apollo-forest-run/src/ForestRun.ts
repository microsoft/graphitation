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
  OptimisticLayer,
  SerializedCache,
  SerializedOperationInfo,
  Store,
  Transaction,
} from "./cache/types";
import { ApolloCache } from "@apollo/client";
import { assert } from "./jsutils/assert";
import { accumulate, deleteAccumulated } from "./jsutils/map";
import { read } from "./cache/read";
import { getNodeChunks } from "./cache/draftHelpers";
import { modify } from "./cache/modify";
import {
  createOptimisticLayer,
  createStore,
  evictOldData,
  getEffectiveReadLayers,
  maybeEvictOldData,
  removeOptimisticLayers,
  resetStore,
} from "./cache/store";
import {
  getDiffDescriptor,
  isFragmentDocument,
  transformDocument,
} from "./cache/descriptor";
import { isWrite, write } from "./cache/write";
import { fieldToStringKey, identify } from "./cache/keys";
import { createCacheEnvironment } from "./cache/env";
import { CacheConfig } from "./cache/types";
import { SourceObject } from "./values/types";
import { logUpdateStats } from "./telemetry/updateStats/logUpdateStats";
import { logStaleOperations } from "./telemetry/logStaleOperations";

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

export class ForestRun extends ApolloCache<SerializedCache> {
  public rawConfig: InMemoryCacheConfig;
  protected env: CacheEnv;
  protected store: Store;

  protected transactionStack: Transaction[] = [];
  protected newWatches = new Set<Cache.WatchOptions>();

  // ApolloCompat:
  public policies = {
    rootTypenamesById: {
      ROOT_QUERY: "Query",
      ROOT_MUTATION: "Mutation",
      ROOT_SUBSCRIPTION: "Subscription",
    },
  };

  protected invalidatedDiffs = new WeakSet<Cache.DiffResult<any>>();
  protected extractedObjects = new WeakMap<any, SerializedOperationInfo>();

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
    const result = modify(this.env, this.store, activeTransaction, options);

    for (const operation of result.affected) {
      // Hack to force-notify invalidated operations even if their diff is the same, should be explicit somehow
      // TODO: remove invalidation after removing read policies and modify API
      for (const watch of this.store.watches.get(operation) ?? EMPTY_ARRAY) {
        if (watch.lastDiff) {
          this.invalidatedDiffs.add(watch.lastDiff);
        }
      }
    }
    activeTransaction.changelog.push(result);
    return result.dirty;
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
    const result = write(this.env, this.store, transaction, options);
    transaction.changelog.push(result);

    const incoming = result.incoming;
    return incoming.nodes.size ? getRef(incoming.rootNodeKey) : undefined;
  }

  private collectAffectedOperationsAndNodes(transaction: Transaction) {
    transaction.affectedOperations ??= new Set();
    transaction.affectedNodes ??= new Set();

    for (const entry of transaction.changelog) {
      // Actual notification will happen on transaction completion (in batch)
      if (entry.options.broadcast === false) {
        continue;
      }
      for (const operation of entry.affected) {
        transaction.affectedOperations.add(operation);
      }
      // Incoming operation may not have been updated, but let "watch" decide how to handle it
      if (isWrite(entry)) {
        transaction.affectedOperations.add(entry.incoming.operation);
      }

      // Append affected nodes (speeds up fragment watch notifications later)
      if (isWrite(entry)) {
        for (const nodeKey of entry.affectedNodes ?? EMPTY_ARRAY) {
          transaction.affectedNodes.add(nodeKey);
        }
      } else {
        const layerDiff = entry.difference?.values();
        for (const layerDifferenceMap of layerDiff ?? EMPTY_ARRAY) {
          for (const nodeKey of layerDifferenceMap.nodeDifference.keys()) {
            transaction.affectedNodes.add(nodeKey);
          }
        }
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
  }

  protected getActiveForest(): DataForest | OptimisticLayer {
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
      logStaleOperations(this.env, rootTransaction, stale);
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
    const diff = this.runRead(options);
    return diff.complete || options.returnPartialData ? diff.result : null;
  }

  public diff<TData, TVariables = any>(
    options: Cache.DiffOptions<TData, TVariables>,
  ): Cache.DiffResult<TData> {
    return this.runRead(options);
  }

  private runRead<TData, TVariables = any>(
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
    return this.env.optimizeFragmentReads &&
      isFragmentDocument(watch.query) &&
      (watch.id || watch.rootId)
      ? this.watchFragment(watch)
      : this.watchOperation(watch);
  }

  private watchOperation(watch: Cache.WatchOptions) {
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

  private watchFragment(watch: Cache.WatchOptions) {
    const id = watch.id ?? watch.rootId;
    assert(id !== undefined);
    accumulate(this.store.fragmentWatches, id, watch);

    return () => {
      deleteAccumulated(this.store.fragmentWatches, id, watch);
    };
  }

  // Compatibility with InMemoryCache for Apollo dev tools
  get data() {
    const extract = this.extract.bind(this);
    return {
      get data() {
        return extract();
      },
    };
  }

  public extract(optimistic = false): SerializedCache {
    const { dataForest } = this.store;
    const key = (operation: OperationDescriptor) =>
      `${operation.debugName}:${operation.id}`;

    const stableConvert = (
      op: OperationDescriptor,
      data: SourceObject | null = null,
      optimisticData: SourceObject | null = null,
      hasHistory = false,
    ): SerializedOperationInfo => {
      const key = data ?? optimisticData;
      assert(key);
      // Need to preserve references to the same object for compatibility with Apollo devtools,
      // which uses strict comparison to detect changes in cache
      let entry = this.extractedObjects.get(key);
      if (entry?.data !== data || entry?.optimisticData !== optimisticData) {
        entry = {
          data,
          variables: op.variables,
          optimisticData,
          hasHistory,
        };
        this.extractedObjects.set(key, entry);
      }
      return entry;
    };

    const output: SerializedCache = {};
    for (const [_, tree] of dataForest.trees.entries()) {
      const historyLength = tree.history?.getAll()?.length ?? 0;
      output[key(tree.operation)] = stableConvert(
        tree.operation,
        tree.result.data,
        null,
        historyLength > 0,
      );
    }
    if (optimistic) {
      for (const layer of this.store.optimisticLayers) {
        for (const [id, optimisticTree] of layer.trees.entries()) {
          const tree = dataForest.trees.get(id);
          const historyLength = tree?.history?.getAll()?.length ?? 0;
          output[key(optimisticTree.operation)] = stableConvert(
            optimisticTree.operation,
            tree?.result.data ?? null,
            optimisticTree.result.data,
            historyLength > 0,
          );
        }
      }
    }

    return output;
  }

  public restore(_: SerializedCache): this {
    throw new Error("ForestRunCache.restore() is not supported");
  }

  public gc(): string[] {
    if (this.env.maxOperationCount) {
      return evictOldData(this.env, this.store).map(String);
    }
    return [];
  }

  public getStats() {
    return {
      docCount: this.store.operations.size,
      treeCount: this.store.dataForest.trees.size,
    };
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
    update: (cache: ForestRun) => any,
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
      affectedNodes: null,
      watchesToNotify: null,
      forceOptimistic,
      changelog: [],
    };
    this.transactionStack.push(activeTransaction);
    let error;
    let result: T | undefined = undefined;
    let watchesToNotify: Set<Cache.WatchOptions> | null = null;
    try {
      result = update(this);

      this.collectAffectedOperationsAndNodes(activeTransaction);

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
      parentTransaction.changelog.push(...activeTransaction.changelog);
      return result as T;
    }
    if (watchesToNotify) {
      this.notifyWatches(
        activeTransaction,
        watchesToNotify,
        onWatchUpdated,
        typeof optimistic === "string",
      );
      logUpdateStats(this.env, activeTransaction.changelog, watchesToNotify);
    }
    maybeEvictOldData(this.env, this.store);

    return result as T;
  }

  private collectAffectedWatches(
    transaction: Transaction,
    onWatchUpdated?: Cache.BatchOptions<any>["onWatchUpdated"],
  ): Set<Cache.WatchOptions> | null {
    if (!transaction.affectedOperations?.size) {
      return transaction.watchesToNotify ?? null;
    }
    // Note: activeTransaction.watchesToNotify may already contain watches delegated by completed nested transactions
    //   so this may not only add watches, but also remove them from accumulator (depending on onWatchUpdated callback)
    const accumulator = transaction.watchesToNotify ?? new Set();
    for (const operation of transaction.affectedOperations) {
      for (const watch of this.store.watches.get(operation) ?? EMPTY_ARRAY) {
        const diff = this.diff(watch);

        if (!this.shouldNotifyWatch(watch, diff, onWatchUpdated)) {
          accumulator.delete(watch);
        } else {
          accumulator.add(watch);
        }
      }
    }
    for (const nodeKey of transaction.affectedNodes ?? EMPTY_ARRAY) {
      const fragmentWatches = this.store.fragmentWatches.get(nodeKey);
      for (const watch of fragmentWatches ?? EMPTY_ARRAY) {
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
    const affectedOps = removeOptimisticLayers(
      this,
      this.env,
      this.store,
      layerTag,
    );

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
