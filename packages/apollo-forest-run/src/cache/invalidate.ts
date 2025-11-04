import type {
  CacheEnv,
  DataForest,
  OptimisticLayer,
  Store,
  TransformedResult,
} from "./types";
import { GraphDifference } from "../diff/diffTree";
import { OperationDescriptor } from "../descriptor/types";
import { NodeDifferenceMap } from "../forest/updateTree";
import { IndexedTree } from "../forest/types";
import { isNodeValue, isObjectValue } from "../values/predicates";
import { assert } from "../jsutils/assert";
import { resolveNormalizedField } from "../descriptor/resolvedSelection";
import { hasFieldEntry } from "../values/resolve";

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
        markChangedNodesAsDirty(results, nodeDiffs, incomingResult);
        if (shouldPushOptimisticHistory(env, targetForest)) {
          results.outputTree.history?.addOptimisticHistoryEntry(
            results.outputTree,
            nodeDiffs,
            incomingResult,
            difference.newNodes,
          );
        }
      }
      if (optimisticResults) {
        markChangedNodesAsDirty(optimisticResults, nodeDiffs, incomingResult);
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
          markIncompleteNodesAsDirty(results, incomingResult);
        }
        if (optimisticResults) {
          markIncompleteNodesAsDirty(optimisticResults, incomingResult);
        }
      }
    }
  }
}

function markIncompleteNodesAsDirty(
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

function shouldPushOptimisticHistory(
  env: CacheEnv,
  targetForest: DataForest | OptimisticLayer,
): boolean {
  return env.enableHistory && targetForest.layerTag !== null;
}

const EMPTY_ARRAY = Object.freeze([]);
