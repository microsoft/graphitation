"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForestRun = void 0;
const equality_1 = require("@wry/equality");
const client_1 = require("@apollo/client");
const assert_1 = require("./jsutils/assert");
const map_1 = require("./jsutils/map");
const read_1 = require("./cache/read");
const draftHelpers_1 = require("./cache/draftHelpers");
const modify_1 = require("./cache/modify");
const store_1 = require("./cache/store");
const descriptor_1 = require("./cache/descriptor");
const write_1 = require("./cache/write");
const keys_1 = require("./cache/keys");
const env_1 = require("./cache/env");
const logUpdateStats_1 = require("./telemetry/updateStats/logUpdateStats");
const logStaleOperations_1 = require("./telemetry/logStaleOperations");
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
const REFS_POOL = new Map(["ROOT_QUERY", "ROOT_SUBSCRIPTION"].map((rootKey) => [
    rootKey,
    Object.freeze({ __ref: rootKey }),
]));
const getRef = (ref) => { var _a; return (_a = REFS_POOL.get(ref)) !== null && _a !== void 0 ? _a : { __ref: ref }; };
class ForestRun extends client_1.ApolloCache {
    constructor(config) {
        super();
        this.config = config;
        this.transactionStack = [];
        this.newWatches = new Set();
        // ApolloCompat:
        this.policies = {
            rootTypenamesById: {
                ROOT_QUERY: "Query",
                ROOT_MUTATION: "Mutation",
                ROOT_SUBSCRIPTION: "Subscription",
            },
        };
        this.invalidatedDiffs = new WeakSet();
        this.extractedObjects = new WeakMap();
        this.env = (0, env_1.createCacheEnvironment)(config);
        this.store = (0, store_1.createStore)(this.env);
        this.rawConfig = config !== null && config !== void 0 ? config : {};
    }
    identify(object) {
        return (0, keys_1.identify)(this.env, object);
    }
    evict(options) {
        var _a, _b;
        if ("id" in options && !options.id) {
            // ApolloCompat
            return false;
        }
        const { id = "ROOT_QUERY", fieldName, args } = options;
        // We need _any_ chunk just to get typeName, so can look even in optimistic layers
        const [firstChunk] = (0, draftHelpers_1.getNodeChunks)((0, store_1.getEffectiveReadLayers)(this.store, this.getActiveForest(), true), id);
        if (!firstChunk) {
            return false;
        }
        if (fieldName) {
            const argValues = args ? new Map(Object.entries(args)) : undefined;
            const storeFieldName = (0, keys_1.fieldToStringKey)(argValues && firstChunk.type
                ? {
                    name: fieldName,
                    args: argValues,
                    keyArgs: (_b = (_a = this.env).keyArgs) === null || _b === void 0 ? void 0 : _b.call(_a, firstChunk.type, fieldName, argValues),
                }
                : fieldName);
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
    modify(options) {
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
    runModify(options) {
        var _a;
        const activeTransaction = peek(this.transactionStack);
        (0, assert_1.assert)(activeTransaction);
        const result = (0, modify_1.modify)(this.env, this.store, activeTransaction, options);
        for (const operation of result.affected) {
            // Hack to force-notify invalidated operations even if their diff is the same, should be explicit somehow
            // TODO: remove invalidation after removing read policies and modify API
            for (const watch of (_a = this.store.watches.get(operation)) !== null && _a !== void 0 ? _a : EMPTY_ARRAY) {
                if (watch.lastDiff) {
                    this.invalidatedDiffs.add(watch.lastDiff);
                }
            }
        }
        activeTransaction.changelog.push(result);
        return result.dirty;
    }
    write(options) {
        return this.transactionStack.length
            ? this.runWrite(options)
            : this.runTransaction({
                update: () => this.runWrite(options),
            });
    }
    runWrite(options) {
        const transaction = peek(this.transactionStack);
        (0, assert_1.assert)(transaction);
        const result = (0, write_1.write)(this.env, this.store, transaction, options);
        transaction.changelog.push(result);
        const incoming = result.incoming;
        return incoming.nodes.size ? getRef(incoming.rootNodeKey) : undefined;
    }
    collectAffectedOperationsAndNodes(transaction) {
        var _a, _b, _c, _d, _e;
        (_a = transaction.affectedOperations) !== null && _a !== void 0 ? _a : (transaction.affectedOperations = new Set());
        (_b = transaction.affectedNodes) !== null && _b !== void 0 ? _b : (transaction.affectedNodes = new Set());
        for (const entry of transaction.changelog) {
            // Actual notification will happen on transaction completion (in batch)
            if (entry.options.broadcast === false) {
                continue;
            }
            for (const operation of entry.affected) {
                transaction.affectedOperations.add(operation);
            }
            // Incoming operation may not have been updated, but let "watch" decide how to handle it
            if ((0, write_1.isWrite)(entry)) {
                transaction.affectedOperations.add(entry.incoming.operation);
            }
            // Append affected nodes (speeds up fragment watch notifications later)
            if ((0, write_1.isWrite)(entry)) {
                for (const nodeKey of (_c = entry.affectedNodes) !== null && _c !== void 0 ? _c : EMPTY_ARRAY) {
                    transaction.affectedNodes.add(nodeKey);
                }
            }
            else {
                const layerDiff = (_d = entry.difference) === null || _d === void 0 ? void 0 : _d.values();
                for (const layerDifferenceMap of layerDiff !== null && layerDiff !== void 0 ? layerDiff : EMPTY_ARRAY) {
                    for (const nodeKey of layerDifferenceMap.nodeDifference.keys()) {
                        transaction.affectedNodes.add(nodeKey);
                    }
                }
            }
            // ApolloCompat: new watches must be notified immediately after the next write
            if (this.newWatches.size) {
                (_e = transaction.watchesToNotify) !== null && _e !== void 0 ? _e : (transaction.watchesToNotify = new Set());
                for (const watch of this.newWatches) {
                    transaction.watchesToNotify.add(watch);
                }
                this.newWatches.clear();
            }
        }
    }
    getActiveForest() {
        var _a;
        const transaction = peek(this.transactionStack);
        return (_a = transaction === null || transaction === void 0 ? void 0 : transaction.optimisticLayer) !== null && _a !== void 0 ? _a : this.store.dataForest;
    }
    notifyWatches(rootTransaction, watchesToNotify, onWatchUpdated, fromOptimisticTransaction) {
        var _a;
        const stale = [];
        const errors = new Map();
        for (const watch of watchesToNotify) {
            try {
                const newDiff = this.diff(watch);
                // ApolloCompat: expected by QueryManager (and looks like only for watches???) :/
                if (fromOptimisticTransaction && watch.optimistic) {
                    newDiff.fromOptimisticTransaction = true;
                }
                if (!newDiff.complete && ((_a = watch.lastDiff) === null || _a === void 0 ? void 0 : _a.complete)) {
                    stale.push({
                        operation: (0, descriptor_1.getDiffDescriptor)(this.env, this.store, watch),
                        diff: newDiff,
                    });
                }
                if (this.shouldNotifyWatch(watch, newDiff, onWatchUpdated)) {
                    this.notifyWatch(watch, newDiff);
                }
            }
            catch (e) {
                errors.set(watch, e);
            }
        }
        if (stale.length) {
            (0, logStaleOperations_1.logStaleOperations)(this.env, rootTransaction, stale);
        }
        if (errors.size) {
            const [firstError] = errors.values();
            throw firstError;
        }
    }
    notifyWatch(watch, diff) {
        const lastDiff = watch.lastDiff;
        watch.lastDiff = diff;
        watch.callback(diff, lastDiff);
    }
    read(options) {
        const diff = this.runRead(options);
        return diff.complete || options.returnPartialData ? diff.result : null;
    }
    diff(options) {
        return this.runRead(options);
    }
    runRead(options) {
        var _a;
        const activeTransaction = peek(this.transactionStack);
        const result = (0, read_1.read)(this.env, this.store, activeTransaction, options);
        if (options.returnPartialData === false && ((_a = result.dangling) === null || _a === void 0 ? void 0 : _a.size)) {
            const [ref] = result.dangling;
            throw new Error(`Dangling reference to missing ${ref} object`);
        }
        if (options.returnPartialData === false && result.missing) {
            throw new Error(result.missing[0].message);
        }
        return result;
    }
    watch(watch) {
        return this.env.optimizeFragmentReads &&
            (0, descriptor_1.isFragmentDocument)(watch.query) &&
            (watch.id || watch.rootId)
            ? this.watchFragment(watch)
            : this.watchOperation(watch);
    }
    watchOperation(watch) {
        const operationDescriptor = (0, descriptor_1.getDiffDescriptor)(this.env, this.store, watch);
        if (watch.immediate /* && !this.transactionStack.length */) {
            const diff = this.diff(watch);
            if (this.shouldNotifyWatch(watch, diff)) {
                this.notifyWatch(watch, diff);
            }
        }
        else {
            // ApolloCompat: new watches must be notified on next transaction completion
            // (even if their corresponding operations were not affected)
            this.newWatches.add(watch);
        }
        (0, map_1.accumulate)(this.store.watches, operationDescriptor, watch);
        return () => {
            this.newWatches.delete(watch);
            (0, map_1.deleteAccumulated)(this.store.watches, operationDescriptor, watch);
        };
    }
    watchFragment(watch) {
        var _a;
        const id = (_a = watch.id) !== null && _a !== void 0 ? _a : watch.rootId;
        (0, assert_1.assert)(id !== undefined);
        (0, map_1.accumulate)(this.store.fragmentWatches, id, watch);
        return () => {
            (0, map_1.deleteAccumulated)(this.store.fragmentWatches, id, watch);
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
    extract(optimistic = false) {
        var _a;
        const { dataForest } = this.store;
        const key = (operation) => `${operation.debugName}:${operation.id}`;
        const stableConvert = (op, data = null, optimisticData = null) => {
            const key = data !== null && data !== void 0 ? data : optimisticData;
            (0, assert_1.assert)(key);
            // Need to preserve references to the same object for compatibility with Apollo devtools,
            // which uses strict comparison to detect changes in cache
            let entry = this.extractedObjects.get(key);
            if ((entry === null || entry === void 0 ? void 0 : entry.data) !== data || (entry === null || entry === void 0 ? void 0 : entry.optimisticData) !== optimisticData) {
                entry = {
                    data,
                    variables: op.variables,
                    optimisticData,
                };
                this.extractedObjects.set(key, entry);
            }
            return entry;
        };
        const output = {};
        for (const [_, tree] of dataForest.trees.entries()) {
            output[key(tree.operation)] = stableConvert(tree.operation, tree.result.data);
        }
        if (optimistic) {
            for (const layer of this.store.optimisticLayers) {
                for (const [id, optimisticTree] of layer.trees.entries()) {
                    const tree = dataForest.trees.get(id);
                    output[key(optimisticTree.operation)] = stableConvert(optimisticTree.operation, (_a = tree === null || tree === void 0 ? void 0 : tree.result.data) !== null && _a !== void 0 ? _a : null, optimisticTree.result.data);
                }
            }
        }
        return output;
    }
    restore(_) {
        throw new Error("ForestRunCache.restore() is not supported");
    }
    gc() {
        if (this.env.maxOperationCount) {
            return (0, store_1.evictOldData)(this.env, this.store).map(String);
        }
        return [];
    }
    getStats() {
        return {
            docCount: this.store.operations.size,
            treeCount: this.store.dataForest.trees.size,
        };
    }
    // Note: this method is necessary for Apollo test suite
    __lookup(key) {
        const result = this.extract();
        return result[key];
    }
    // ApolloCompat
    retain() {
        return 0;
    }
    reset(options) {
        (0, store_1.resetStore)(this.store);
        if (options === null || options === void 0 ? void 0 : options.discardWatches) {
            this.newWatches.clear();
            this.store.watches.clear();
        }
        return Promise.resolve();
    }
    /**
     * @deprecated use batch
     */
    performTransaction(update, optimisticId) {
        return this.runTransaction({
            update,
            optimistic: optimisticId || optimisticId !== null,
        });
    }
    batch(options) {
        return this.runTransaction(options);
    }
    runTransaction(options) {
        var _a, _b, _c;
        const parentTransaction = peek(this.transactionStack);
        const { update, optimistic, removeOptimistic, onWatchUpdated } = options;
        let optimisticLayer;
        let forceOptimistic = null;
        if (typeof optimistic === "string") {
            // See a note in removeOptimisticLayer on why
            const replay = () => this.runTransaction(options);
            optimisticLayer = (0, store_1.createOptimisticLayer)(optimistic, replay);
            this.store.optimisticLayers.push(optimisticLayer);
        }
        else if (optimistic === false) {
            optimisticLayer = (_a = parentTransaction === null || parentTransaction === void 0 ? void 0 : parentTransaction.optimisticLayer) !== null && _a !== void 0 ? _a : null;
            forceOptimistic = false;
        }
        else {
            optimisticLayer = (_b = parentTransaction === null || parentTransaction === void 0 ? void 0 : parentTransaction.optimisticLayer) !== null && _b !== void 0 ? _b : null;
        }
        const activeTransaction = {
            optimisticLayer,
            affectedOperations: null,
            affectedNodes: null,
            watchesToNotify: null,
            forceOptimistic,
            changelog: [],
        };
        this.transactionStack.push(activeTransaction);
        let error;
        let result = undefined;
        let watchesToNotify = null;
        try {
            result = update(this);
            this.collectAffectedOperationsAndNodes(activeTransaction);
            // This must run within transaction itself, because it runs `diff` under the hood
            // which may need to read results from the active optimistic layer
            watchesToNotify = this.collectAffectedWatches(activeTransaction, onWatchUpdated);
        }
        catch (e) {
            error = e;
        }
        (0, assert_1.assert)(activeTransaction === peek(this.transactionStack));
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
            (_c = parentTransaction.watchesToNotify) !== null && _c !== void 0 ? _c : (parentTransaction.watchesToNotify = new Set());
            for (const watch of watchesToNotify !== null && watchesToNotify !== void 0 ? watchesToNotify : EMPTY_ARRAY) {
                parentTransaction.watchesToNotify.add(watch);
            }
            parentTransaction.changelog.push(...activeTransaction.changelog);
            return result;
        }
        if (watchesToNotify) {
            this.notifyWatches(activeTransaction, watchesToNotify, onWatchUpdated, typeof optimistic === "string");
            (0, logUpdateStats_1.logUpdateStats)(this.env, activeTransaction.changelog, watchesToNotify);
        }
        (0, store_1.maybeEvictOldData)(this.env, this.store);
        return result;
    }
    collectAffectedWatches(transaction, onWatchUpdated) {
        var _a, _b, _c, _d, _e;
        if (!((_a = transaction.affectedOperations) === null || _a === void 0 ? void 0 : _a.size)) {
            return (_b = transaction.watchesToNotify) !== null && _b !== void 0 ? _b : null;
        }
        // Note: activeTransaction.watchesToNotify may already contain watches delegated by completed nested transactions
        //   so this may not only add watches, but also remove them from accumulator (depending on onWatchUpdated callback)
        const accumulator = (_c = transaction.watchesToNotify) !== null && _c !== void 0 ? _c : new Set();
        for (const operation of transaction.affectedOperations) {
            for (const watch of (_d = this.store.watches.get(operation)) !== null && _d !== void 0 ? _d : EMPTY_ARRAY) {
                const diff = this.diff(watch);
                if (!this.shouldNotifyWatch(watch, diff, onWatchUpdated)) {
                    accumulator.delete(watch);
                }
                else {
                    accumulator.add(watch);
                }
            }
        }
        for (const nodeKey of (_e = transaction.affectedNodes) !== null && _e !== void 0 ? _e : EMPTY_ARRAY) {
            const fragmentWatches = this.store.fragmentWatches.get(nodeKey);
            for (const watch of fragmentWatches !== null && fragmentWatches !== void 0 ? fragmentWatches : EMPTY_ARRAY) {
                const diff = this.diff(watch);
                if (!this.shouldNotifyWatch(watch, diff, onWatchUpdated)) {
                    accumulator.delete(watch);
                }
                else {
                    accumulator.add(watch);
                }
            }
        }
        return accumulator;
    }
    shouldNotifyWatch(watch, newDiff, onWatchUpdated) {
        const lastDiff = watch.lastDiff;
        // ApolloCompat:
        // Special case - identical diff, but switched from optimistic transaction to a regular one
        // We need to notify parent mutation's onQueryUpdated callback via onWatchUpdated
        // see useMutation.test.tsx "can pass onQueryUpdated to useMutation"
        if (lastDiff &&
            lastDiff.result == newDiff.result &&
            lastDiff.fromOptimisticTransaction !==
                newDiff.fromOptimisticTransaction &&
            onWatchUpdated &&
            onWatchUpdated.call(this, watch, newDiff, lastDiff) === false) {
            return false;
        }
        // ApolloCompat:
        //   Another special case: cache.modify allows to INVALIDATE individual fields without affecting diffs.
        //   For those we should call onWatchUpdated but don't actually notify watchers 🤷‍
        if (lastDiff &&
            newDiff.result == lastDiff.result &&
            this.invalidatedDiffs.has(lastDiff)) {
            this.invalidatedDiffs.delete(lastDiff);
            onWatchUpdated && onWatchUpdated.call(this, watch, newDiff, lastDiff);
            return false;
        }
        // Always notify when there is no "lastDiff" (first notification)
        // intentionally not strict (null == undefined)
        if (lastDiff && newDiff.result == lastDiff.result) {
            return false;
        }
        if (lastDiff &&
            !newDiff.complete &&
            !lastDiff.complete &&
            !watch.returnPartialData &&
            (0, equality_1.equal)(lastDiff.result, newDiff.result)) {
            // Already notified about partial data once
            return false;
        }
        // ApolloCompat: let transaction initiator decide
        if (onWatchUpdated &&
            onWatchUpdated.call(this, watch, newDiff, lastDiff) === false) {
            return false;
        }
        return true;
    }
    removeOptimistic(layerTag) {
        return this.transactionStack.length
            ? this.removeOptimisticLayers(layerTag)
            : this.runTransaction({
                update: () => this.removeOptimisticLayers(layerTag),
            });
    }
    removeOptimisticLayers(layerTag) {
        var _a;
        const activeTransaction = peek(this.transactionStack);
        (0, assert_1.assert)(activeTransaction);
        (_a = activeTransaction.affectedOperations) !== null && _a !== void 0 ? _a : (activeTransaction.affectedOperations = new Set());
        const affectedOps = (0, store_1.removeOptimisticLayers)(this, this.env, this.store, layerTag);
        for (const operation of affectedOps !== null && affectedOps !== void 0 ? affectedOps : EMPTY_ARRAY) {
            activeTransaction.affectedOperations.add(operation);
        }
    }
    transformDocument(document) {
        return this.env.addTypename ? (0, descriptor_1.transformDocument)(document) : document;
    }
}
exports.ForestRun = ForestRun;
function peek(stack) {
    return stack[stack.length - 1];
}
