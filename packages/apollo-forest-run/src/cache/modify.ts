import type { Reference, StoreObject, StoreValue, Cache } from "@apollo/client";
import type {
  Modifier,
  Modifiers,
  ReadFieldOptions,
} from "@apollo/client/cache/core/types/common";
import type {
  FieldInfo,
  NodeKey,
  NormalizedFieldEntry,
  OperationDescriptor,
} from "../descriptor/types";
import type {
  GraphValue,
  SourceScalar,
  CompositeListChunk,
  ObjectChunk,
} from "../values/types";
import type {
  CacheEnv,
  DataForest,
  OptimisticLayer,
  Store,
  Transaction,
  TransformedResult,
} from "./types";
import type { ObjectDiffState, Replacement } from "../diff/types";
import type { GraphDiffError } from "../diff/diffTree";
import { isReference, makeReference } from "@apollo/client";
import { maybeDeepFreeze } from "@apollo/client/utilities";
import { equal } from "@wry/equality";
import * as Value from "../values";
import * as Difference from "../diff/difference";
import { getNodeChunks, getObjectChunks } from "./draftHelpers";
import {
  canRead,
  FieldPolicyReadContext,
  maybeReturnRef,
  readField,
  toReference,
} from "./policies";
import { assert } from "../jsutils/assert";
import { DifferenceKind } from "../diff/types";
import { fieldToStringKey } from "./keys";
import { ConversionContext, toGraphCompositeChunk } from "./convert";
import {
  getActiveForest,
  getEffectiveReadLayers,
  getEffectiveWriteLayers,
} from "./store";
import {
  resolveAffectedOperations,
  updateAffectedTrees,
} from "../forest/updateForest";
import { invalidateReadResults } from "./invalidate";
import { IndexedTree } from "../forest/types";
import { getFieldName } from "../descriptor/resolvedSelection";

const EMPTY_ARRAY = Object.freeze([]);
const DELETE: any = Object.freeze(Object.create(null));
const INVALIDATE: any = Object.freeze(Object.create(null));

export type ModifiedNodeDifference = ObjectDiffState & {
  fieldsToInvalidate: Set<NormalizedFieldEntry>;
  fieldsToDelete: Set<NormalizedFieldEntry>;
  deleteNode: boolean;
};
type ModifiedGraphDifference = {
  nodeDifference: Map<NodeKey, ModifiedNodeDifference>;
  newNodes: NodeKey[];
  deletedNodes: NodeKey[];
  errors: GraphDiffError[];
};
type LayerDifferenceMap = Map<
  DataForest | OptimisticLayer,
  ModifiedGraphDifference
>;

export function modify(
  env: CacheEnv,
  store: Store,
  activeTransaction: Transaction,
  options: Cache.ModifyOptions,
): [dirty: boolean, affected: Set<OperationDescriptor>] {
  const id = options.id ?? "ROOT_QUERY";
  const optimistic =
    activeTransaction.forceOptimistic ?? options.optimistic ?? false;

  const targetForest = getActiveForest(store, activeTransaction);
  const layers = getEffectiveWriteLayers(store, targetForest, optimistic);
  const layerDifferenceMap = runModifiers(env, layers, id, options.fields);

  if (!layerDifferenceMap.size) {
    return [false, new Set()];
  }

  let deletedFromLayers = 0;
  let deletedFieldsFromLayers = 0;
  let updatedLayers = 0;

  // Applying layers difference first (then we will invalidate read results)
  const affectedOperations = new Map();
  const chunkProvider = (key: NodeKey) =>
    getNodeChunks(getEffectiveReadLayers(store, targetForest, false), key);

  for (const [layer, layerDifference] of layerDifferenceMap.entries()) {
    resolveAffectedOperations(layer, layerDifference, affectedOperations);
    const updated = updateAffectedTrees(
      env,
      targetForest,
      affectedOperations,
      chunkProvider,
    );
    updatedLayers += updated ? 1 : 0;

    if (layerDifference.deletedNodes.length) {
      for (const id of layerDifference.deletedNodes) {
        deleteNode(layer, id);
      }
      deletedFromLayers++;
      continue;
    }

    const nodeDifference = layerDifference.nodeDifference.get(id);
    assert(nodeDifference);
    const deletedFields = nodeDifference.fieldsToDelete;

    if (deletedFields.size) {
      const deleted = deletedNodeFields(store, layer, id, deletedFields);
      if (deleted) {
        deletedFieldsFromLayers++;
      }
    }
  }

  // Invalidate read results
  // allAffectedOps includes all modified + those affected only in read results
  const allAffectedOps = new Set(affectedOperations.keys());

  for (const [layer, layerDifference] of layerDifferenceMap.entries()) {
    const operationIds = layer.operationsByNodes.get(id);
    const nodeDifference = layerDifference.nodeDifference.get(id);
    assert(nodeDifference);

    // Invalidate modified fields in read results
    invalidateReadResults(
      env,
      store,
      layer,
      layerDifference,
      affectedOperations,
    );

    const dirtyFields = nodeDifference.fieldsToInvalidate;

    // Invalidate deleted / invalidated fields in read results
    for (const operationId of operationIds ?? EMPTY_ARRAY) {
      const operation = layer.trees.get(operationId)?.operation;
      if (!operation) {
        continue;
      }

      if (deletedFromLayers || deletedFieldsFromLayers) {
        layer.readResults.delete(operation);
        store.optimisticReadResults.delete(operation);
        allAffectedOps.add(operation);
        continue;
      }

      let affected = false;
      const results = layer.readResults.get(operation);
      const optimisticResults = store.optimisticReadResults.get(operation);

      if (results) {
        const invalidated = addDirtyNodeFields(results, id, dirtyFields);
        affected ||= invalidated;
      }
      if (optimisticResults) {
        const invalidated = addDirtyNodeFields(
          optimisticResults,
          id,
          dirtyFields,
        );
        affected ||= invalidated;
      }
      if (affected) {
        allAffectedOps.add(operation);
      }
    }
  }
  const modified =
    updatedLayers > 0 || deletedFromLayers > 0 || deletedFieldsFromLayers > 0;

  return [modified, allAffectedOps];
}

function runModifiers(
  env: CacheEnv,
  layers: (DataForest | OptimisticLayer)[],
  nodeKey: string,
  fields: Modifier<any> | Modifiers,
): LayerDifferenceMap {
  const layerDifferenceMap: LayerDifferenceMap = new Map();
  const context: FieldPolicyReadContext = {
    env,
    layers,
  };
  const modifyOptions = {
    fieldName: "",
    storeFieldName: "",
    storage: {},

    DELETE,
    INVALIDATE,
    isReference,
    toReference: toReference.bind(context),
    canRead: canRead.bind(context),
    readField: (
      fieldNameOrOptions: string | ReadFieldOptions,
      from?: StoreObject | Reference,
    ) =>
      readField.call(
        context as any,
        typeof fieldNameOrOptions === "string"
          ? {
              fieldName: fieldNameOrOptions,
              from: from || makeReference(nodeKey),
            }
          : fieldNameOrOptions,
      ),
  };

  for (const layer of layers) {
    const chunks = [...getNodeChunks([layer], nodeKey)];
    if (!chunks.length) {
      continue;
    }
    const node = Value.createObjectAggregate(chunks);
    const fieldNames = Value.aggregateFieldNames(node);

    const difference = Difference.createObjectDifference();
    const nodeDifference: ModifiedNodeDifference = {
      difference,
      fieldsToDelete: new Set(),
      fieldsToInvalidate: new Set(),
      deleteNode: true,
    };

    for (const fieldName of fieldNames) {
      const tmp = Value.aggregateFieldEntries(node, fieldName);
      if (!tmp) {
        continue;
      }
      const fieldEntries = Array.isArray(tmp) ? tmp : [tmp];

      for (const fieldEntry of fieldEntries) {
        modifyOptions.fieldName = fieldName;
        modifyOptions.storeFieldName = fieldToStringKey(fieldEntry);
        modifyOptions.storage = {}; // TODO (?)

        // TODO: use conversion utils instead
        const oldValue = Value.aggregateFieldValue(node, fieldEntry);
        const oldSourceValue =
          oldValue !== undefined
            ? maybeReturnRef(env, Value.getFirstSourceValue(oldValue))
            : undefined;

        if (oldValue === undefined || oldSourceValue === undefined) {
          // Missing value
          continue;
        }

        const modify: Modifier<StoreValue> =
          typeof fields === "function"
            ? fields
            : fields[modifyOptions.storeFieldName] || fields[fieldName];

        if (!modify) {
          nodeDifference.deleteNode = false;
          continue;
        }

        const newSourceValue = modify(
          maybeDeepFreeze(oldSourceValue),
          modifyOptions,
        );
        if (newSourceValue === DELETE) {
          nodeDifference.fieldsToDelete.add(fieldEntry);
          continue;
        }
        nodeDifference.deleteNode = false;
        if (newSourceValue === INVALIDATE) {
          nodeDifference.fieldsToInvalidate.add(fieldEntry);
          continue;
        }
        if (
          equal(oldSourceValue, newSourceValue) ||
          newSourceValue === undefined
        ) {
          continue;
        }

        const replacement: Replacement = {
          kind: DifferenceKind.Replacement,
          oldValue,
          newValue: toGraphValue(env, layer, oldValue, newSourceValue),
        };
        Difference.addFieldDifference(difference, fieldEntry, replacement);
        Difference.addDirtyField(difference, fieldEntry);
      }
    }
    if (
      Difference.isDirty(difference) ||
      nodeDifference.fieldsToInvalidate.size ||
      nodeDifference.fieldsToDelete.size ||
      nodeDifference.deleteNode
    ) {
      const graphDifference: ModifiedGraphDifference = {
        nodeDifference: new Map([[nodeKey, nodeDifference]]),
        newNodes: EMPTY_ARRAY as unknown as NodeKey[],
        deletedNodes: nodeDifference.deleteNode
          ? [nodeKey]
          : (EMPTY_ARRAY as unknown as NodeKey[]),
        errors: EMPTY_ARRAY as unknown as GraphDiffError[],
      };
      layerDifferenceMap.set(layer, graphDifference);
    }
  }
  return layerDifferenceMap;
}

function deleteNode(layer: DataForest | OptimisticLayer, nodeKey: string) {
  layer.deletedNodes.add(nodeKey);

  // TODO (mayby): instead of mutating trees directly, we should have updateForest() which accepts GraphDifference
  //   and produces a new forest value (with structural sharing). This new value can later fully replace the forest in here.
  //   (this is hard, but allows to rollback on errors in the middle of mutation + have history/log of the whole forest)
  const operations = layer.operationsByNodes.get(nodeKey);
  for (const operation of operations ?? EMPTY_ARRAY) {
    const tree = layer.trees.get(operation);
    if (!tree) {
      continue;
    }
    const chunks = tree.nodes.get(nodeKey);
    if (!chunks?.length) {
      continue;
    }
    const pathEnv: Value.TraverseEnv = {
      findParent: Value.createParentLocator(tree.dataMap),
    };
    for (const chunk of chunks) {
      const chunkRef = pathEnv.findParent(chunk);
      const { selection } = chunk;
      if (!chunkRef) {
        // Orphan chunk
        continue;
      }
      if (Value.isParentObjectRef(chunkRef)) {
        deleteTreeChunkField(pathEnv, tree, chunkRef.parent, chunkRef.field);
        continue;
      }
      if (Value.isParentListRef(chunkRef)) {
        deleteTreeChunkItem(pathEnv, tree, chunkRef.parent, chunkRef.index);
        continue;
      }
      // When deleting root node - also delete all of its fields
      for (const fieldAliases of selection.fields.values()) {
        for (const fieldAlias of fieldAliases) {
          if (selection.skippedFields?.has(fieldAlias)) {
            continue;
          }
          deleteTreeChunkField(pathEnv, tree, chunk, fieldAlias);
        }
      }
      // TODO: should we differentiate between incomplete/deleted chunks ?
      tree.incompleteChunks.add(chunk);
    }
  }
}

function addDirtyNodeFields(
  { dirtyNodes, outputTree }: TransformedResult,
  nodeKey: string,
  dirtyFields: Set<NormalizedFieldEntry>,
): boolean {
  let currentDirtyFields = dirtyNodes.get(nodeKey);
  if (currentDirtyFields?.size === 0) {
    // Going to diff all fields anyways
    return true;
  }
  if (!currentDirtyFields) {
    currentDirtyFields = new Set<string>();
  }

  const chunks = outputTree.nodes.get(nodeKey) ?? EMPTY_ARRAY;
  for (const dirtyField of dirtyFields) {
    // TODO: do not add field if doesn't actually exist in this operation
    if (chunks.some((chunk) => Value.hasFieldEntry(chunk, dirtyField))) {
      currentDirtyFields.add(getFieldName(dirtyField));
    }
  }
  if (currentDirtyFields.size) {
    dirtyNodes.set(nodeKey, currentDirtyFields);
    return true;
  }
  return false;
}

function deletedNodeFields(
  store: Store,
  layer: DataForest | OptimisticLayer,
  nodeKey: string,
  deletedFields: Set<NormalizedFieldEntry>,
) {
  let deletedFromOperations = 0;
  const operationIds = layer.operationsByNodes.get(nodeKey);
  for (const operationId of operationIds ?? EMPTY_ARRAY) {
    const tree = layer.trees.get(operationId);
    if (!tree) {
      continue;
    }
    const operation = tree.operation;
    const pathEnv: Value.TraverseEnv = {
      findParent: Value.createParentLocator(tree.dataMap),
    };
    const deleted = deleteTreeNodeFields(pathEnv, tree, nodeKey, deletedFields);

    if (deleted) {
      deletedFromOperations++;
    }
    const readResult = layer.readResults.get(operation);
    const optimisticReadResult = store.optimisticReadResults.get(operation);

    if (readResult) {
      const outputTree = readResult.outputTree;
      pathEnv.findParent = Value.createParentLocator(outputTree.dataMap);
      deleteTreeNodeFields(pathEnv, outputTree, nodeKey, deletedFields);
    }
    if (optimisticReadResult) {
      const outputTree = optimisticReadResult.outputTree;
      pathEnv.findParent = Value.createParentLocator(outputTree.dataMap);
      deleteTreeNodeFields(pathEnv, outputTree, nodeKey, deletedFields);
    }
  }
  return deletedFromOperations > 0;
}

function deleteTreeNodeFields(
  env: Value.TraverseEnv,
  tree: IndexedTree,
  nodeKey: string,
  deletedFields: Set<NormalizedFieldEntry>,
) {
  let deleted = false;
  const chunks = tree.nodes.get(nodeKey);

  for (const chunk of chunks ?? EMPTY_ARRAY) {
    for (const deletedField of deletedFields) {
      const fieldAliases = Value.resolveMatchingFieldAliases(
        chunk,
        deletedField,
      );
      for (const fieldAlias of fieldAliases) {
        const didDelete = deleteTreeChunkField(env, tree, chunk, fieldAlias);
        deleted ||= didDelete;
      }
    }
  }
  return deleted;
}

function deleteTreeChunkField(
  pathEnv: Value.TraverseEnv,
  tree: IndexedTree,
  chunk: ObjectChunk,
  field: FieldInfo,
) {
  const didDelete = Value.deleteField(pathEnv, chunk, field);
  if (didDelete) {
    tree.incompleteChunks.add(chunk);
  }
  return didDelete;
}

function deleteTreeChunkItem(
  pathEnv: Value.TraverseEnv,
  tree: IndexedTree,
  chunk: CompositeListChunk,
  index: number,
) {
  const didDelete = Value.deleteListItem(pathEnv, chunk, index);
  if (didDelete) {
    tree.incompleteChunks.add(chunk);
  }
  return didDelete;
}

// TODO: move this to "convert"
function toGraphValue(
  env: CacheEnv,
  layer: DataForest | OptimisticLayer,
  base: GraphValue,
  newSourceValue: StoreValue,
): GraphValue {
  // TODO: invariants here require additional validation of newSourceValue right after modify call
  //   (otherwise they are not invariants because user code may return whatever it wants)
  if (typeof base !== "object" || base === null) {
    assert(
      (typeof newSourceValue !== "object" || newSourceValue === null) &&
        newSourceValue !== undefined,
    );
    assert(typeof base === typeof newSourceValue || newSourceValue === null);
    return newSourceValue as SourceScalar;
  }
  if (Value.isCompositeValue(base)) {
    assert(typeof newSourceValue === "object" && newSourceValue !== null);
    // TODO: for base aggregates - return aggregate value too
    const oldChunk = Value.isAggregate(base) ? base.chunks[0] : base;

    const context: ConversionContext = {
      env,
      operation: oldChunk.operation,
      recyclableValues: new Map(),
      danglingReferences: new Set(),
      getChunks: (ref) => getObjectChunks([layer], ref),
    };

    return toGraphCompositeChunk(
      context,
      oldChunk.possibleSelections,
      newSourceValue as StoreObject,
    );
  }

  throw new Error(
    `ForestRun doesn't support ${base.kind} value in cache.modify() API`,
  );
}
