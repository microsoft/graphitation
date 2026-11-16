import type {
  CacheEnv,
  DataForest,
  DirtyNodeMap,
  OptimisticLayer,
  Store,
  TransformedResult,
} from "./types";
import { GraphDifference } from "../diff/diffTree";
import { OperationDescriptor } from "../descriptor/types";
import { NodeDifferenceMap } from "../forest/updateTree";
import { IndexedTree } from "../forest/types";
import type { NodeChunk, ObjectChunk } from "../values/types";
import { isNodeValue, isObjectValue } from "../values/predicates";
import { assert } from "../jsutils/assert";
import { resolveNormalizedField } from "../descriptor/resolvedSelection";
import { hasFieldEntry } from "../values/resolve";
import { createOptimisticHistoryEntry } from "../values/history";

export function invalidateReadResults(
  env: CacheEnv,
  store: Store,
  targetForest: DataForest | OptimisticLayer,
  difference: GraphDifference,
  affectedOperations: Map<OperationDescriptor, NodeDifferenceMap>,
  incomingResult?: IndexedTree,
) {
  const {
    dataForest,
    optimisticLayers,
    optimisticReadResults,
    partialReadResults,
  } = store;

  const layers = [dataForest, ...optimisticLayers];
  for (const layer of layers) {
    for (const [operation, nodeDiffs] of affectedOperations.entries()) {
      const results = layer.readResults.get(operation);
      const optimisticResults = optimisticReadResults.get(operation);

      if (results) {
        markChangedNodesAsDirty(env, results, nodeDiffs, incomingResult);
        if (shouldPushOptimisticHistory(targetForest, results.outputTree)) {
          results.outputTree.history.push(
            createOptimisticHistoryEntry(
              results.outputTree,
              nodeDiffs,
              incomingResult,
              difference.newNodes,
              env,
            ),
          );
        }
      }
      if (optimisticResults) {
        markChangedNodesAsDirty(
          env,
          optimisticResults,
          nodeDiffs,
          incomingResult,
        );
      }
    }

    // ApolloCompat: field policies may return dangling references to nodes that do not exist.
    //   When this happens, operations with dangling references must be invalidated when nodes are actually added
    //   (this only affects readResults, right???)
    for (const nodeKey of difference.newNodes) {
      layer.deletedNodes.delete(nodeKey);

      const operationsWithDanglingRefs =
        layer.operationsWithDanglingRefs.get(nodeKey);

      for (const operation of operationsWithDanglingRefs ?? EMPTY_ARRAY) {
        const results = layer.readResults.get(operation);
        const optimisticResults = optimisticReadResults.get(operation);

        if (results) {
          results.dirtyNodes.set(nodeKey, new Set());
        }
        if (optimisticResults) {
          optimisticResults.dirtyNodes.set(nodeKey, new Set());
        }
      }
    }

    // ApolloCompat
    // Some read results may contain partial nodes produces by "read" policies.
    // Incoming operations can bring missing data for those nodes which might not be reflected in a difference
    //   (because difference is calculated for the "server" or "written" state of the operation,
    //   it doesn't apply to "read" state).
    // Thus, we must additionally mark as dirty any read operations with missing nodes (if they have overlapping fields)
    if (incomingResult) {
      for (const operation of partialReadResults) {
        const results = layer.readResults.get(operation);
        const optimisticResults = optimisticReadResults.get(operation);

        if (results) {
          markIncompleteNodesAsDirty(env, results, incomingResult);
        }
        if (optimisticResults) {
          markIncompleteNodesAsDirty(env, optimisticResults, incomingResult);
        }
      }
    }
  }
}

function markIncompleteNodesAsDirty(
  env: CacheEnv,
  readResult: TransformedResult,
  incomingResult: IndexedTree,
) {
  const { outputTree, dirtyNodes } = readResult;

  for (const incompleteChunk of outputTree.incompleteChunks) {
    if (!isNodeValue(incompleteChunk)) {
      continue;
    }
    const chunks = incomingResult.nodes.get(incompleteChunk.key);
    if (!chunks?.length) {
      continue;
    }
    if (env.optimizeIncompleteChunkInvalidation) {
      markProvidedMissingFieldsAsDirty(incompleteChunk, chunks, dirtyNodes);
      continue;
    }
    let dirtyFields = dirtyNodes.get(incompleteChunk.key);
    for (const missingField of incompleteChunk.missingFields ?? EMPTY_ARRAY) {
      const normalizedField = resolveNormalizedField(
        incompleteChunk.selection,
        missingField,
      );
      if (chunks.some((chunk) => hasFieldEntry(chunk, normalizedField))) {
        dirtyFields ??= new Set();
        dirtyFields.add(missingField.name);
      }
    }
    if (dirtyFields?.size) {
      dirtyNodes.set(incompleteChunk.key, dirtyFields);
    }
  }
}

function markChangedNodesAsDirty(
  env: CacheEnv,
  readResult: TransformedResult,
  nodeDifference: NodeDifferenceMap,
  incomingResult?: IndexedTree,
) {
  const { outputTree, dirtyNodes } = readResult;

  const nodeMap = outputTree.nodes;
  for (const [nodeKey, diff] of nodeDifference.entries()) {
    let currentDirtyFields = dirtyNodes.get(nodeKey);
    if (currentDirtyFields?.size === 0) {
      continue; // Must run full diff of all fields
    }
    if (!currentDirtyFields) {
      currentDirtyFields = new Set();
    }
    const nodes = nodeMap.get(nodeKey);
    for (const node of nodes ?? EMPTY_ARRAY) {
      // TODO: more granular invalidation of fields with read policies
      if (node.hasNestedReadPolicies) {
        currentDirtyFields.clear(); // run full diff of all fields
        dirtyNodes.set(nodeKey, currentDirtyFields);
        continue;
      }
      for (const dirtyField of diff?.dirtyFields ?? EMPTY_ARRAY) {
        if (node.selection.fields.has(dirtyField)) {
          currentDirtyFields.add(dirtyField);
        }
      }
    }
    if (currentDirtyFields.size > 0) {
      dirtyNodes.set(nodeKey, currentDirtyFields);
    }
  }
  // readResults may contain nodes that do not exist in the main operation (via Apollo cache redirects or optimistic updates).
  //   We keep track of those additional "read" dependencies via forest.operationsByNodes, so they will be properly invalidated
  //   when those nodes change. However, when readResults contain missing fields and incoming operation simply brings
  //   new data for those nodes (but not changes per se) - those nodes won't be invalidated without the code below.
  if (env.optimizeIncompleteChunkInvalidation && incomingResult) {
    markIncompleteChunksProvidedByIncomingResult(
      readResult,
      incomingResult,
      env,
    );
    return;
  }
  const incompleteChunks = outputTree.incompleteChunks;
  for (const chunk of incompleteChunks) {
    if (!isObjectValue(chunk) || typeof chunk.key !== "string") {
      continue;
    }
    if (incomingResult && !incomingResult.nodes.has(chunk.key)) {
      continue;
    }
    assert(chunk.missingFields?.size);
    let currentDirtyFields = dirtyNodes.get(chunk.key);
    if (!currentDirtyFields) {
      currentDirtyFields = new Set();
      dirtyNodes.set(chunk.key, currentDirtyFields);
    }
    for (const field of chunk.missingFields) {
      currentDirtyFields.add(field.name);
    }
  }
}

/**
 * Optimized counterpart of the incomplete chunks loop in `markChangedNodesAsDirty` (`optimizeIncompleteChunkInvalidation`).
 *
 * Instead of marking all missing fields of incomplete node chunks as dirty whenever incoming result contains
 * the same node, marks only missing fields that incoming chunks actually provide. This uses the same field matching
 * as hydration (normalized field entries: arguments / keyArgs aware, alias-independent), so a missing field that
 * is not marked here can't be resolved from incoming chunks on re-hydration anyway.
 *
 * Note: dirty fields computed here are always a subset of the fields marked by the conservative loop
 *   (which marks every missing field of the chunk)
 */
function markIncompleteChunksProvidedByIncomingResult(
  readResult: TransformedResult,
  incomingResult: IndexedTree,
  env: CacheEnv,
) {
  const { outputTree, dirtyNodes } = readResult;

  for (const chunk of outputTree.incompleteChunks) {
    if (!isNodeValue(chunk)) {
      continue;
    }
    const incomingChunks = incomingResult.nodes.get(chunk.key);
    if (!incomingChunks?.length) {
      continue;
    }
    assert(chunk.missingFields?.size);

    if (dirtyNodes.get(chunk.key)?.size === 0) {
      continue; // Already scheduled for full diff of all fields: must not be downgraded to specific fields
    }
    if (chunk.hasNestedReadPolicies || hasReadPolicies(env, chunk)) {
      // Read policies may compute fields from data outside of the selection (e.g. via readField / toReference),
      //   so conservatively mark all missing fields as dirty (same as the non-optimized loop)
      markAllMissingFieldsAsDirty(chunk, dirtyNodes);
      continue;
    }
    markProvidedMissingFieldsAsDirty(chunk, incomingChunks, dirtyNodes);
  }
}

function markAllMissingFieldsAsDirty(
  chunk: NodeChunk,
  dirtyNodes: DirtyNodeMap,
) {
  assert(chunk.missingFields?.size);
  let dirtyFields = dirtyNodes.get(chunk.key);
  assert(dirtyFields?.size !== 0, "Full diff must not be downgraded");
  if (!dirtyFields) {
    dirtyFields = new Set();
    dirtyNodes.set(chunk.key, dirtyFields);
  }
  for (const field of chunk.missingFields) {
    dirtyFields.add(field.name);
  }
}

function markProvidedMissingFieldsAsDirty(
  incompleteChunk: NodeChunk,
  incomingChunks: ObjectChunk[],
  dirtyNodes: DirtyNodeMap,
) {
  let dirtyFields = dirtyNodes.get(incompleteChunk.key);
  if (dirtyFields?.size === 0) {
    return; // Already scheduled for full diff of all fields
  }
  for (const missingField of incompleteChunk.missingFields ?? EMPTY_ARRAY) {
    if (dirtyFields?.has(missingField.name)) {
      continue;
    }
    const normalizedField = resolveNormalizedField(
      incompleteChunk.selection,
      missingField,
    );
    const isProvided = incomingChunks.some((incomingChunk) => {
      assert(incomingChunk.key === incompleteChunk.key);
      return hasFieldEntry(incomingChunk, normalizedField);
    });
    if (isProvided) {
      // Dirty fields are matched by name against chunk selections (see isDirtyNode),
      //   so the field must be a part of the incomplete chunk selection to trigger re-hydration
      assert(incompleteChunk.selection.fields.has(missingField.name));
      dirtyFields ??= new Set();
      dirtyFields.add(missingField.name);
    }
  }
  if (dirtyFields?.size) {
    dirtyNodes.set(incompleteChunk.key, dirtyFields);
  }
}

function hasReadPolicies(env: CacheEnv, chunk: NodeChunk): boolean {
  const fieldPolicies =
    typeof chunk.type === "string" ? env.readPolicies.get(chunk.type) : null;
  if (!fieldPolicies?.size) {
    return false;
  }
  for (const fieldName of chunk.selection.fields.keys()) {
    if (fieldPolicies.has(fieldName)) {
      return true;
    }
  }
  return false;
}

function shouldPushOptimisticHistory(
  targetForest: DataForest | OptimisticLayer,
  outputTree: IndexedTree,
): boolean {
  return targetForest.layerTag !== null && !!outputTree.operation.historySize;
}

const EMPTY_ARRAY = Object.freeze([]);
