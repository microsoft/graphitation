import type { IndexedTree, UpdateTreeResult } from "../forest/types";
import type {
  GraphValue,
  ObjectChunk,
  OperationResult,
  SourceObject,
} from "../values/types";
import type {
  CacheEnv,
  DataForest,
  DataTree,
  ModifyResult,
  OptimisticLayer,
  Store,
  Transaction,
  WriteResult,
  ExecutionKey,
  ExecutionResult,
  IncrementalDeferResult,
  IncrementalExecution,
  PendingResult,
  SubsequentIncrementalExecutionResult,
  WriteOptions,
} from "./types";
import type { NodeKey, OperationDescriptor } from "../descriptor/types";
import { assert } from "../jsutils/assert";
import {
  getFragmentDescriptor,
  isFragmentDocument,
  resolveResultDescriptor,
  resolveOperationDescriptor,
  ROOT_NODES,
  ROOT_TYPES,
} from "./descriptor";
import { applyMergePolicies } from "./policies";
import {
  getActiveForest,
  getEffectiveReadLayers,
  touchOperation,
} from "./store";
import { diffNodes, diffTree, GraphDifference } from "../diff/diffTree";
import { diffObject } from "../diff/diffObject";
import * as Difference from "../diff/difference";
import {
  resolveAffectedOperations,
  updateAffectedTrees,
} from "../forest/updateForest";
import { indexTree } from "../forest/indexTree";
import type {
  DeferLabel,
  DeferTarget,
  DeferTargetKey,
  DeferTargets,
  EmbeddedPath,
  ResponsePath,
} from "../descriptor/types";
import {
  resolveNormalizedField,
  resolveSelection,
} from "../descriptor/resolvedSelection";
import { addDirtyChunkDifference } from "../forest/transformTree";
import {
  resolveObjectAddress,
  createParentLocator,
  getDataPathForDebugging,
  isCompositeListValue,
  isObjectValue,
  isSourceObject,
  markAsPartial,
  resolveFieldValue,
  resolveListItemChunk,
  TraverseEnv,
} from "../values";
import { NodeDifferenceMap } from "../forest/updateTree";
import { getNodeChunks } from "./draftHelpers";
import { replaceTree } from "../forest/addTree";
import { invalidateReadResults } from "./invalidate";
import { IndexedForest } from "../forest/types";

type ResultWrite = {
  // Key of the written object (when it is not the root node of the operation)
  rootNodeKey?: NodeKey;
  // Object embedded into its closest node, which the result is written to
  embedded?: EmbeddedObject;
  // Collects targets of deferred fragments found in the result
  defer?: {
    execution: IncrementalExecution;
    // Whether the result is a deferred fragment (vs the initial result)
    isFragment: boolean;
    path: ResponsePath;
    // Address of the root of an embedded result
    root?: { dataId: NodeKey; subPath: EmbeddedPath };
  };
};

type EmbeddedObject = { tree: IndexedTree; chunk: ObjectChunk };

// Root key of a result written to an embedded object (never leaves the incoming tree)
const EMBEDDED_ROOT_KEY = "__FOREST_RUN_EMBEDDED_OBJECT__";

/**
 * Writes a complete result, or results of incremental delivery (see `ExecutionResult`).
 *
 * An initial result is written as a complete result, additionally remembering targets of its deferred fragments.
 * Each deferred fragment of a subsequent result is written to its target as a fragment.
 */
export function write(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  options: WriteOptions,
): WriteResult[] {
  const { objectKey, keyMap } = env;
  const execution: ExecutionResult = options.execution ?? {
    data:
      typeof options.result === "object" && options.result !== null
        ? options.result
        : {},
  };
  const writeData =
    "data" in execution ? ((execution.data ?? {}) as SourceObject) : undefined;
  const rootNodeKey =
    options.dataId ?? (writeData ? objectKey(writeData) : undefined);
  assert(rootNodeKey !== false);

  // ApolloCompat (apollo allows writing fragments without proper id in the data)
  if (writeData && rootNodeKey !== undefined && options.dataId) {
    keyMap?.set(writeData, rootNodeKey);
  }
  const operationDescriptor = resolveOperationDescriptor(
    env,
    store,
    options.query,
    options.variables,
    rootNodeKey,
  );
  touchOperation(env, store, operationDescriptor);
  if (!operationDescriptor.cache) {
    // Results of this operation are never stored, so nothing will ever evict its descriptor.
    // Remember it, so that the outermost transaction can release it on completion.
    // (the set only exists when `env.cleanupNonCacheableOperations` is enabled)
    activeTransaction.nonCacheableOperations?.add(operationDescriptor);
  }
  if (!writeData) {
    return writeIncremental(
      env,
      store,
      activeTransaction,
      operationDescriptor,
      options,
      execution as SubsequentIncrementalExecutionResult & {
        key?: ExecutionKey;
      },
    );
  }
  if (
    !ROOT_TYPES.includes(operationDescriptor.rootType) &&
    rootNodeKey === undefined
  ) {
    throw new Error(`Could not identify object ${inspect(writeData)}`);
  }
  if (!("hasNext" in execution) || !execution.hasNext) {
    return [
      writeResult(env, store, activeTransaction, operationDescriptor, options, {
        data: writeData,
      }),
    ];
  }
  // Initial result of an incremental execution
  const incremental: IncrementalExecution = {
    key: execution.key,
    targets: new Map(),
    pending: new Map(),
  };
  addPendingResults(incremental, execution.pending);
  store.incrementalExecutions.set(operationDescriptor, incremental);
  return [
    writeResult(
      env,
      store,
      activeTransaction,
      operationDescriptor,
      options,
      { data: writeData, hasNext: true } as OperationResult,
      { defer: { execution: incremental, path: [], isFragment: false } },
    ),
  ];
}

function writeIncremental(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  operation: OperationDescriptor,
  options: WriteOptions,
  execution: SubsequentIncrementalExecutionResult & { key?: ExecutionKey },
): WriteResult[] {
  const incremental = store.incrementalExecutions.get(operation);
  if (!incremental || incremental.key !== execution.key) {
    return [];
  }
  addPendingResults(incremental, execution.pending);

  const results: WriteResult[] = [];
  for (const entry of execution.incremental ?? EMPTY_ARRAY) {
    // Note: streamed list items (`items`) are not supported
    if (!("data" in entry) || !isSourceObject(entry.data)) {
      continue;
    }
    const pending =
      entry.id !== undefined ? incremental.pending.get(entry.id) : entry;
    const target = pending?.path
      ? entry.id === undefined
        ? // Earlier draft: every deferred fragment is delivered in a single payload
          completeDeferredFragment(
            incremental.targets,
            pending.path,
            pending.label,
          )
        : getPendingTarget(incremental.targets, pending.path, pending.label)
      : undefined;
    if (!target) {
      continue;
    }
    const result = writeDeferredFragment(
      env,
      store,
      activeTransaction,
      operation,
      options,
      incremental,
      target,
      entry as IncrementalDeferResult & { data: SourceObject },
    );
    if (result) {
      results.push(result);
    }
  }
  for (const { id } of execution.completed ?? EMPTY_ARRAY) {
    const pending = incremental.pending.get(id);
    if (pending) {
      completeDeferredFragment(
        incremental.targets,
        pending.path,
        pending.label,
      );
    }
    incremental.pending.delete(id);
  }
  if (!execution.hasNext) {
    store.incrementalExecutions.delete(operation);
  }
  return results;
}

/**
 * Writes data of a deferred fragment (or of an object within it at `subPath`) to the object the fragment
 * was deferred on, even if the operation doesn't reach that object anymore (missing objects are not created).
 */
function writeDeferredFragment(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  operation: OperationDescriptor,
  options: WriteOptions,
  incremental: IncrementalExecution,
  target: DeferTarget,
  entry: IncrementalDeferResult & { data: SourceObject },
): WriteResult | undefined {
  let { selection, typeName } = target;
  const subPath = [...target.subPath];
  for (const step of entry.subPath ?? EMPTY_ARRAY) {
    if (typeof step === "number") {
      subPath.push(step);
      continue;
    }
    const resolved = resolveSelection(operation, selection, typeName ?? null);
    const field = resolved.fieldQueue.find((field) => field.dataKey === step);
    if (!field?.selection) {
      return;
    }
    subPath.push(resolveNormalizedField(resolved, field));
    selection = field.selection;
    typeName = undefined;
  }
  const data = { ...entry.data };
  typeName ??= data.__typename;
  if (typeName) {
    data.__typename ??= typeName;
  }
  const forest = getActiveForest(store, activeTransaction);
  const object = resolveTargetObject(forest, target.dataId, subPath);
  if (!object) {
    return;
  }
  const path = entry.path ?? [
    ...(incremental.pending.get(entry.id as string)?.path ?? EMPTY_ARRAY),
    ...(entry.subPath ?? EMPTY_ARRAY),
  ];
  return writeResult(
    env,
    store,
    activeTransaction,
    getFragmentDescriptor(env, operation, selection, typeName ?? ""),
    { ...options, dataId: undefined },
    { ...entry, data } as OperationResult,
    {
      rootNodeKey: object.embedded ? EMBEDDED_ROOT_KEY : object.dataId,
      embedded: object.embedded,
      defer: {
        execution: incremental,
        isFragment: true,
        path,
        root: object.embedded ? object : undefined,
      },
    },
  );
}

/**
 * Resolves the target object of a deferred fragment in the cache (without creating anything).
 */
function resolveTargetObject(
  forest: IndexedForest,
  dataId: NodeKey,
  subPath: EmbeddedPath,
):
  | { dataId: NodeKey; subPath: EmbeddedPath; embedded?: EmbeddedObject }
  | undefined {
  if (!subPath.length) {
    return { dataId, subPath };
  }
  for (const operationId of forest.operationsByNodes.get(dataId) ?? []) {
    const tree = forest.trees.get(operationId);
    for (const node of tree?.nodes.get(dataId) ?? EMPTY_ARRAY) {
      let value = node as GraphValue | undefined;
      for (let i = 0; i < subPath.length && value; i++) {
        const step = subPath[i];
        if (typeof step === "number") {
          value =
            isCompositeListValue(value) && !value.isAggregate
              ? resolveListItemChunk(value, step)
              : undefined;
        } else {
          value =
            isObjectValue(value) && !value.isAggregate
              ? resolveFieldValue(value, step)
              : undefined;
        }
        if (value && isObjectValue(value) && !value.isAggregate && value.key) {
          // The path continues within another node
          return resolveTargetObject(forest, value.key, subPath.slice(i + 1));
        }
      }
      if (tree && value && isObjectValue(value) && !value.isAggregate) {
        return { dataId, subPath, embedded: { tree, chunk: value } };
      }
    }
  }
  return undefined;
}

function addPendingResults(
  incremental: IncrementalExecution,
  pending: ReadonlyArray<PendingResult> | undefined,
) {
  for (const result of pending ?? EMPTY_ARRAY) {
    if (result.id !== undefined) {
      incremental.pending.set(result.id, result);
    }
  }
}

function writeResult(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  operationDescriptor: OperationDescriptor,
  options: WriteOptions,
  operationResult: OperationResult,
  { rootNodeKey, embedded, defer }: ResultWrite = {},
): WriteResult {
  const { mergePolicies, addTypename } = env;
  const targetForest = getActiveForest(store, activeTransaction);
  const writeData = operationResult.data;

  let existingResult = rootNodeKey
    ? undefined
    : getExistingResult(env, store, targetForest, operationDescriptor);
  const existingData = existingResult?.result.data;

  // Safeguard: make sure previous state doesn't leak outside write operation
  assert(!existingResult?.prev);

  if (writeData === existingData && existingResult && !defer) {
    return {
      options,
      incoming: existingResult,
      affected: [],
      difference: undefined,
      affectedNodes: new Set(),
      updateStats: [],
    };
  }

  if (!rootNodeKey && !ROOT_NODES.includes(operationDescriptor.rootNodeKey)) {
    const typeName = resolveExtraRootNodeType(
      env,
      store,
      operationDescriptor,
      writeData,
    );
    if (addTypename && typeName && !writeData["__typename"]) {
      writeData["__typename"] = typeName;
    }
    targetForest.extraRootIds.set(
      operationDescriptor.rootNodeKey,
      typeName ?? "",
    );
    operationDescriptor.rootType = typeName ?? "";
  }

  const incomingResult = indexTree(
    env,
    operationDescriptor,
    operationResult,
    undefined,
    existingResult,
    rootNodeKey,
  );
  const incomingRootKey = incomingResult.rootNodeKey;

  // ApolloCompat: necessary for fragment writes with custom ids
  if (options.dataId && incomingResult.rootNodeKey !== options.dataId) {
    const rootNode = incomingResult.nodes.get(incomingResult.rootNodeKey);
    assert(rootNode);
    incomingResult.nodes.set(options.dataId, rootNode);
    incomingResult.nodes.delete(incomingResult.rootNodeKey);
    incomingResult.rootNodeKey = options.dataId;
  }

  const modifiedIncomingResult = applyMergePolicies(
    env,
    getEffectiveReadLayers(store, targetForest, false),
    mergePolicies,
    incomingResult,
    options.overwrite ?? false,
    embedded?.chunk,
  );
  if (defer) {
    addDeferTargets(
      defer,
      incomingResult,
      modifiedIncomingResult,
      incomingRootKey,
    );
  }

  const diff = (forest: IndexedForest) =>
    embedded
      ? diffEmbedded(env, forest, modifiedIncomingResult, embedded)
      : diffTree(forest, modifiedIncomingResult, env);
  const difference = diff(targetForest);

  if (difference.errors.length) {
    processDiffErrors(targetForest, modifiedIncomingResult, difference);
  }

  if (
    existingResult &&
    existingResult.grown &&
    existingResult.incompleteChunks.size > 0
  ) {
    // Remove incomplete placeholder tree (saves unnecessary update)
    targetForest.trees.delete(operationDescriptor.id);
    existingResult = undefined;
  }

  // This function returns exhaustive list of affected operations. It may contain false-positives,
  // because operationsWithNodes also reflects nodes from optimistic updates and read policy results
  // (which may not exist in the main forest trees)
  const affectedOperations = resolveAffectedOperations(
    targetForest,
    difference,
  );

  const chunkProvider = (key: NodeKey) =>
    getNodeChunks(getEffectiveReadLayers(store, targetForest, false), key);

  const allUpdates = updateAffectedTrees(
    env,
    targetForest,
    affectedOperations,
    chunkProvider,
    modifiedIncomingResult,
  );

  // Results written to a specific object (deferred fragments) are not stored
  if (
    !existingResult &&
    !rootNodeKey &&
    shouldCache(targetForest, operationDescriptor)
  ) {
    affectedOperations.set(operationDescriptor, difference.nodeDifference);
    // Note: even with existingResult === undefined the tree for this operation may still exist in the cache
    //   (when existingResult is resolved with a different key descriptor due to key variables)
    // TODO: replace with addTree and add a proper check for keyVariables
    replaceTree(env, targetForest, modifiedIncomingResult);
  }

  appendAffectedOperationsFromOtherLayers(
    store,
    affectedOperations,
    targetForest,
    diff,
  );

  invalidateReadResults(
    env,
    store,
    targetForest,
    difference,
    affectedOperations,
    modifiedIncomingResult,
  );
  incomingResult.prev = null;
  modifiedIncomingResult.prev = null;

  return {
    options,
    incoming: modifiedIncomingResult,
    affected: affectedOperations.keys(),
    difference,
    affectedNodes: aggregateAllAffectedNodes(difference, allUpdates),
    updateStats: allUpdates.map((update) => update.stats ?? null),
  };
}

/**
 * Registers targets of deferred fragments found while indexing a result.
 *
 * Response paths come from the indexed result. Merge policies may move embedded objects
 * (e.g. append a page to existing list items), so cache addresses are resolved in the merged result.
 */
function addDeferTargets(
  { execution, path, root, isFragment }: NonNullable<ResultWrite["defer"]>,
  indexed: IndexedTree,
  merged: IndexedTree,
  rootKey: NodeKey,
) {
  const findIndexedParent = createParentLocator(indexed.dataMap);
  const findMergedParent = createParentLocator(merged.dataMap);
  for (const chunk of indexed.chunksWithDeferredFragments ?? EMPTY_ARRAY) {
    if (isFragment && chunk.data === indexed.result.data) {
      // Fragments of the patched object were registered by the result which delivered the object
      continue;
    }
    const mergedChunk = merged.dataMap.get(chunk.data)?.value;
    const address =
      mergedChunk && isObjectValue(mergedChunk) && !mergedChunk.isAggregate
        ? resolveObjectAddress(findMergedParent, mergedChunk, rootKey)
        : undefined;
    if (!address) {
      continue;
    }
    let { dataId, subPath } = address;
    if (root && dataId === rootKey) {
      dataId = root.dataId;
      subPath = [...root.subPath, ...subPath];
    }
    const responsePath = [
      ...path,
      ...getDataPathForDebugging({ findParent: findIndexedParent }, chunk),
    ];
    const pending = (chunk.selection.deferredFragments ?? EMPTY_ARRAY).map(
      ({ label }) => label,
    );
    addDeferTarget(execution.targets, {
      path: responsePath,
      dataId,
      subPath,
      typeName: chunk.type || undefined,
      selection: chunk.possibleSelections,
      pending,
    });
  }
  indexed.chunksWithDeferredFragments = undefined;
}
function addDeferTarget(targets: DeferTargets, target: DeferTarget) {
  const key = targetKey(target.path);
  const existing = targets.get(key);
  if (!existing) {
    targets.set(key, target);
    return;
  }
  // The same object may be indexed again (e.g. delivered by an enclosing deferred fragment)
  for (const label of new Set(target.pending)) {
    const count = target.pending.filter((other) => other === label).length;
    while (existing.pending.filter((other) => other === label).length < count) {
      existing.pending.push(label);
    }
  }
}

function getPendingTarget(
  targets: DeferTargets,
  path: ResponsePath,
  label: DeferLabel | undefined,
): DeferTarget | undefined {
  const target = targets.get(targetKey(path));
  return target && findPending(target, label) !== -1 ? target : undefined;
}

/**
 * Marks a deferred fragment as delivered. Returns the target if the fragment was pending.
 */
function completeDeferredFragment(
  targets: DeferTargets,
  path: ResponsePath,
  label: DeferLabel | undefined,
): DeferTarget | undefined {
  const key = targetKey(path);
  const target = targets.get(key);
  const index = target ? findPending(target, label) : -1;
  if (!target || index === -1) {
    return undefined;
  }
  target.pending.splice(index, 1);
  if (!target.pending.length) {
    targets.delete(key);
  }
  return target;
}

// Payloads without labels match any pending fragment of the object
function findPending(target: DeferTarget, label: DeferLabel | undefined) {
  const index = target.pending.indexOf(label);
  return index === -1 && label === undefined && target.pending.length
    ? 0
    : index;
}

function targetKey(path: ResponsePath): DeferTargetKey {
  return JSON.stringify(path);
}
function appendAffectedOperationsFromOtherLayers(
  store: Store,
  affectedForestOperationsMutable: Map<OperationDescriptor, NodeDifferenceMap>,
  targetForest: DataForest | OptimisticLayer,
  diff: (forest: IndexedForest) => GraphDifference,
) {
  // Optimistic reads go through all existing layers
  //  And those layers may be affected by incoming results too, so we actually need to diff all other layers too
  //  TODO: just write to all effective layers?
  for (const layer of getEffectiveReadLayers(store, targetForest, true)) {
    if (layer === targetForest) {
      continue;
    }
    resolveAffectedOperations(
      layer,
      diff(layer),
      affectedForestOperationsMutable,
    );
  }
}

/**
 * An embedded object is not a node: its difference is recorded on the closest node
 * (nested nodes of the incoming object are diffed as usual).
 */
function diffEmbedded(
  env: CacheEnv,
  forest: IndexedForest,
  incoming: IndexedTree,
  target: EmbeddedObject,
): GraphDifference {
  const nodes = new Map(incoming.nodes);
  const [root] = nodes.get(incoming.rootNodeKey) ?? EMPTY_ARRAY;
  nodes.delete(incoming.rootNodeKey);
  assert(root);

  const graphDifference = diffNodes(forest, nodes, env);
  const { difference } = diffObject(target.chunk, root, env);
  if (difference && Difference.isDirty(difference)) {
    addDirtyChunkDifference(
      {
        findParent: createParentLocator(target.tree.dataMap),
        nodeDifference: graphDifference.nodeDifference,
      },
      target.chunk,
      difference,
    );
  }
  return graphDifference;
}

function processDiffErrors(
  forest: DataForest | OptimisticLayer,
  model: IndexedTree,
  difference: GraphDifference,
) {
  const pathEnv: TraverseEnv = {
    findParent: (chunk) => {
      const tree = forest.trees.get(chunk.operation.id);
      const parentInfo = tree?.dataMap.get(chunk.data);
      assert(parentInfo);
      return parentInfo;
    },
  };

  for (const diffError of difference.errors) {
    if (diffError.kind === "MissingFields") {
      for (const baseChunkError of diffError.base ?? EMPTY_ARRAY) {
        // Missing chunks
        const chunk = baseChunkError.chunk;
        chunk.missingFields ??= new Set();
        for (const field of baseChunkError.missingFields) {
          chunk.missingFields.add(field);
        }
        const tree = forest.trees.get(chunk.operation.id);
        if (tree) {
          tree.incompleteChunks.add(chunk);
        }
        const parentInfo = pathEnv.findParent(chunk);
        markAsPartial(pathEnv, parentInfo);
      }

      pathEnv.findParent = createParentLocator(model.dataMap);
      for (const modelChunkError of diffError.model ?? EMPTY_ARRAY) {
        // Missing chunks
        const chunk = modelChunkError.chunk;
        chunk.missingFields ??= new Set();
        for (const field of modelChunkError.missingFields) {
          chunk.missingFields.add(field);
        }
        const parentInfo = pathEnv.findParent(chunk);
        markAsPartial(pathEnv, parentInfo);
        model.incompleteChunks.add(chunk);
      }
    }
  }
}

function getExistingResult(
  env: CacheEnv,
  store: Store,
  targetForest: IndexedForest,
  operation: OperationDescriptor,
): DataTree | undefined {
  const op = resolveResultDescriptor(env, store, operation);
  return targetForest.trees.get(op.id);
}

function shouldCache(
  targetForest: DataForest | OptimisticLayer,
  operation: OperationDescriptor,
) {
  // Always cache results for optimistic layers (even if operation is not cacheable, e.g. it is a mutation)
  if (targetForest.layerTag !== null) {
    return true;
  }
  return operation.cache;
}

function aggregateAllAffectedNodes(
  difference: GraphDifference,
  updates: UpdateTreeResult[],
): Set<NodeKey> {
  const accumulator = new Set<NodeKey>([
    ...difference.newNodes,
    ...difference.nodeDifference.keys(),
  ]);
  for (const { affectedNodes } of updates) {
    for (const nodeKey of affectedNodes) {
      accumulator.add(nodeKey);
    }
  }
  return accumulator;
}

function resolveExtraRootNodeType(
  env: CacheEnv,
  store: Store,
  operationDescriptor: OperationDescriptor,
  data: Record<string, unknown> & { __typename?: string },
): string | undefined {
  if (data["__typename"]) {
    return data["__typename"];
  }
  // Try fragment condition (fragments on abstract types are ignored)
  if (isFragmentDocument(operationDescriptor.document)) {
    const [fragmentDef] = operationDescriptor.fragmentMap.values();
    const typeName = fragmentDef?.typeCondition.name.value;
    if (!env.possibleTypes?.[typeName]) {
      return typeName;
    }
  }
  // Finally, try from store
  const [chunk] = getNodeChunks(
    [store.dataForest, ...store.optimisticLayers],
    operationDescriptor.rootNodeKey,
  );
  if (chunk?.type) {
    return chunk.type;
  }
  return undefined;
}

const inspect = JSON.stringify.bind(JSON);
const EMPTY_ARRAY = Object.freeze([]);

export function isWrite(op: WriteResult | ModifyResult): op is WriteResult {
  return "incoming" in op; // write has "incoming" tree
}
