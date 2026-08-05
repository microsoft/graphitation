import type {
  CompositeListChunk,
  CompositeValueChunk,
  CompositeUndefinedChunk,
  DataMap,
  GraphChunkReference,
  MissingFieldsMap,
  NodeChunk,
  NodeMap,
  ObjectChunk,
  ObjectDraft,
  OperationResult,
  RootChunkReference,
  SourceCompositeList,
  SourceObject,
  TypeMap,
  ParentLocator,
} from "../values/types";
import type {
  FieldInfo,
  NormalizedFieldEntry,
  OperationDescriptor,
  PossibleSelections,
} from "../descriptor/types";
import type { ForestEnv, IndexedTree } from "./types";
import { ValueKind } from "../values/types";
import {
  fieldEntriesAreEqual,
  getFieldName,
  resolveNormalizedField,
  resolveSelection,
} from "../descriptor/resolvedSelection";
import { accumulate } from "../jsutils/map";
import { assert } from "../jsutils/assert";
import { CircularBuffer } from "../jsutils/circularBuffer";
import {
  createCompositeListChunk,
  createCompositeNullChunk,
  createCompositeUndefinedChunk,
  createObjectChunk,
  createParentLocator,
  getDataPathForDebugging,
  isRootRef,
  isSourceCompositeValue,
  isSourceObject,
  markAsPartial,
} from "../values";

type Context = {
  env: ForestEnv;
  operation: OperationDescriptor;
  result: OperationResult;
  nodes: NodeMap;
  typeMap: TypeMap;
  dataMap: DataMap;
  rootNodeKey: string;
  knownMissingFields: MissingFieldsMap | undefined;
  incompleteChunks: Set<ObjectChunk>;
  recycleTree: IndexedTree | null;
  findParent: ParentLocator;
};

const EMPTY_ARRAY = Object.freeze([]);

export function indexTree(
  env: ForestEnv,
  operation: OperationDescriptor,
  result: OperationResult,
  knownMissingFields?: MissingFieldsMap,
  previousTreeState: IndexedTree | null = null,
): IndexedTree {
  let rootNodeKey;
  try {
    rootNodeKey =
      env.objectKey(
        result.data,
        resolveSelection(
          operation,
          operation.possibleSelections,
          operation.rootType,
        ),
        operation,
      ) || operation.rootNodeKey;
  } catch (e) {
    rootNodeKey = operation.rootNodeKey;
  }
  const dataMap = new Map();
  const context: Context = {
    env: env,
    operation,
    result,
    knownMissingFields,
    nodes: new Map(),
    typeMap: new Map(),
    dataMap,
    incompleteChunks: new Set(),
    rootNodeKey,
    recycleTree: previousTreeState,
    findParent: createParentLocator(dataMap),
  };
  const rootRef: RootChunkReference = {
    value: null,
    parent: null,
    detached: false,
  };
  rootRef.value = indexSourceObject(
    context,
    result.data,
    operation.possibleSelections,
    rootRef,
  );
  assertConsistentListFields(context);
  return {
    operation,
    result,
    rootNodeKey,
    nodes: context.nodes,
    typeMap: context.typeMap,
    dataMap: context.dataMap,
    incompleteChunks: context.incompleteChunks,
    prev: previousTreeState,
    history:
      previousTreeState?.history ?? new CircularBuffer(operation.historySize),
  };
}

type ListFieldOccurrence = {
  fieldEntry: NormalizedFieldEntry;
  field: FieldInfo;
  chunk: NodeChunk;
  list: CompositeListChunk;
};

/**
 * A single write may contain the same node in several places (reached through different paths or
 * different selections). Indexing treats all those occurrences as one entity and aggregates their
 * field values, which is only sound when every occurrence agrees on the value of a given field.
 *
 * Lists are where a disagreement becomes destructive: resolving an item of an aggregated list
 * addresses chunks by index, so an index that is valid for the longest occurrence is applied to the
 * shorter ones too. The shorter chunk then grows its internal item index past its own data, leaving
 * holes behind. Those holes survive in cache state and blow up later, on an unrelated write that
 * recycles the affected chunk ("Cannot read properties of undefined (reading 'value')").
 *
 * There is no correct way to merge lists of different lengths for the same node, so reject the
 * payload here, where the offending data is still available to point at.
 */
function assertConsistentListFields(context: Context) {
  for (const chunks of context.nodes.values()) {
    if (chunks.length < 2) {
      continue;
    }
    const seen: ListFieldOccurrence[] = [];
    for (const chunk of chunks) {
      for (const ref of chunk.fieldChunks.values()) {
        if (ref.value.kind !== ValueKind.CompositeList) {
          continue;
        }
        const list = ref.value;
        const fieldEntry = resolveNormalizedField(chunk.selection, ref.field);
        const first = seen.find((occurrence) =>
          fieldEntriesAreEqual(occurrence.fieldEntry, fieldEntry),
        );
        if (!first) {
          seen.push({ fieldEntry, field: ref.field, chunk, list });
          continue;
        }
        if (first.list.data.length !== list.data.length) {
          throw new Error(
            malformedPayloadError(context, first, {
              fieldEntry,
              field: ref.field,
              chunk,
              list,
            }),
          );
        }
      }
    }
  }
}

function malformedPayloadError(
  context: Context,
  first: ListFieldOccurrence,
  second: ListFieldOccurrence,
): string {
  const { operation } = context;
  const nodeKey = first.chunk.key || "(unknown)";
  const typeName = first.chunk.type || "(unknown type)";
  const fieldName = getFieldName(first.fieldEntry);

  return [
    `Attempting to write malformed payload to the cache: node "${nodeKey}" occurs multiple times ` +
      `in a single write with a different number of items in the "${fieldName}" list.`,
    ``,
    `  Operation:  ${operation.debugName}`,
    `  Node:       ${nodeKey} (${typeName})`,
    `  Field:      ${describeFieldEntry(first.fieldEntry)}`,
    ``,
    describeOccurrence(context, 1, first),
    describeOccurrence(context, 2, second),
    ``,
    `All occurrences of the same node in one payload are aggregated into a single cache value, so ` +
      `they must agree on the value of every field. Lists of different lengths cannot be aggregated: ` +
      `items of the longer list are looked up by index in the shorter one, which corrupts internal ` +
      `cache state and surfaces as "Cannot read properties of undefined (reading 'value')" on a ` +
      `later write.`,
    ``,
    `Fix the payload so every occurrence of "${nodeKey}" carries the same "${fieldName}" value, or ` +
      `stop selecting "${fieldName}" in all but one of the paths above.`,
  ].join("\n");
}

function describeFieldEntry(fieldEntry: NormalizedFieldEntry): string {
  if (typeof fieldEntry === "string") {
    return fieldEntry;
  }
  const args = [...(fieldEntry.args?.entries() ?? [])]
    .map(([name, value]) => `${name}: ${JSON.stringify(value)}`)
    .join(", ");
  return args ? `${fieldEntry.name}(${args})` : fieldEntry.name;
}

function describeOccurrence(
  context: Context,
  index: number,
  occurrence: ListFieldOccurrence,
): string {
  const { list, chunk, field } = occurrence;
  const itemCount = list.data.length;
  return [
    `  Occurrence ${index}: ${itemCount} ${
      itemCount === 1 ? "item" : "items"
    } at ${describePath(context, occurrence)}`,
    `                 selected fields of ${chunk.key || "the node"}: ${
      Object.keys(chunk.data).join(", ") || "(none)"
    }`,
    `                 field alias: ${field.dataKey}`,
  ].join("\n");
}

function describePath(
  context: Context,
  occurrence: ListFieldOccurrence,
): string {
  // The tree is fully indexed at this point, but stay defensive: this runs while reporting an error.
  try {
    const path = getDataPathForDebugging(context, occurrence.list);
    return path.length ? `data.${path.join(".")}` : "data";
  } catch (e) {
    return `<unknown path>.${occurrence.field.dataKey}`;
  }
}

// Matches ObjectChunkReference structure with additional fields
export type IndexedObject = {
  value: ObjectChunk;
  parent: null;
  detached: boolean;
  dataMap: DataMap;
  nodes: NodeMap;
};

export function indexObject(
  env: ForestEnv,
  operation: OperationDescriptor,
  source: SourceObject,
  selection: PossibleSelections,
  knownMissingFields?: MissingFieldsMap,
  dataMap: DataMap = new Map(),
): IndexedObject {
  const isRoot = operation.possibleSelections === selection;
  const rootNodeKey =
    env.objectKey(
      source,
      resolveSelection(
        operation,
        operation.possibleSelections,
        source.__typename || null,
      ),
    ) || (isRoot ? operation.rootNodeKey : "");

  const context: Context = {
    env: env,
    operation,
    knownMissingFields,
    result: { data: source },
    nodes: new Map(),
    typeMap: new Map(),
    dataMap,
    incompleteChunks: new Set(),
    rootNodeKey,
    recycleTree: null,
    findParent: createParentLocator(dataMap),
  };
  const result = {
    value: null as unknown,
    parent: null,
    detached: !isRoot,
    nodes: context.nodes,
    dataMap: context.dataMap,
  };
  result.value = indexSourceObject(
    context,
    source,
    selection,
    result as RootChunkReference,
  );
  return result as IndexedObject;
}

export function indexDraft(
  env: ForestEnv,
  { data, dangling, operation, possibleSelections, missingFields }: ObjectDraft,
): ObjectChunk | CompositeUndefinedChunk {
  if (!data || dangling) {
    return createCompositeUndefinedChunk(operation, possibleSelections);
  }
  // Note: using indexObject vs createObjectChunk for convenience:
  //  indexing properly handles missing fields in nested objects
  return indexObject(env, operation, data, possibleSelections, missingFields)
    .value;
}

function indexSourceObject(
  context: Context,
  source: SourceObject,
  possibleSelections: PossibleSelections,
  parent: GraphChunkReference,
) {
  const recycleTree = context.recycleTree;
  const recyclable =
    recycleTree?.dataMap.get(source) ?? recycleTree?.prev?.dataMap.get(source);

  if (recyclable) {
    return reIndexObject(context, recyclable.value as ObjectChunk, parent);
  }

  const {
    env,
    nodes,
    typeMap,
    operation: op,
    knownMissingFields,
    dataMap,
  } = context;

  const isRoot = isRootRef(parent) && !parent.detached;
  const typeName = isRoot
    ? source.__typename ?? op.rootType
    : source.__typename;

  const selection = resolveSelection(op, possibleSelections, typeName || null);
  const objectKeyResult = isRoot
    ? context.rootNodeKey
    : env.objectKey(source, selection, context.operation);

  const key = typeof objectKeyResult === "string" ? objectKeyResult : false;
  const missingFields = knownMissingFields?.get(source);

  const chunk = createObjectChunk(
    op,
    possibleSelections,
    source,
    key,
    missingFields,
  );

  if (parent) {
    dataMap.set(source, parent);
  }

  if (missingFields?.size) {
    markAsPartial(context, parent);
    context.incompleteChunks.add(chunk);
  }
  if (key !== false) {
    accumulate(nodes, key, chunk);
  }
  if (typeName !== undefined) {
    accumulate(typeMap, typeName, chunk as NodeChunk);
  }
  if (!selection.fieldsWithSelections?.length) {
    if (isRoot && selection.fieldQueue.length) {
      // Special case: detect "empty" trees for operations without selections, e.g. query `{ foo }` and result `{}`
      //   (such trees are not uncommon - they are created as placeholders for watchQueries that are in flight)
      const field = selection.fieldQueue[0];
      if (source[field.dataKey] === undefined) {
        chunk.missingFields ??= new Set();
        chunk.missingFields.add(field);
        context.incompleteChunks.add(chunk);
      }
    }
    return chunk;
  }
  for (const fieldName of selection.fieldsWithSelections) {
    const aliases = selection.fields.get(fieldName) ?? EMPTY_ARRAY;

    for (const fieldInfo of aliases) {
      const value = source[fieldInfo.dataKey];
      const entryParentInfo = {
        value: null as any,
        parent: chunk,
        field: fieldInfo,
      };
      assert(fieldInfo.selection && isSourceCompositeValue(value, fieldInfo));
      let fieldValue: CompositeValueChunk;
      if (Array.isArray(value)) {
        fieldValue = indexSourceList(
          context,
          value,
          fieldInfo.selection,
          entryParentInfo,
        );
      } else if (isSourceObject(value)) {
        fieldValue = indexSourceObject(
          context,
          value,
          fieldInfo.selection,
          entryParentInfo,
        );
      } else if (value === null) {
        fieldValue = createCompositeNullChunk(
          context.operation,
          fieldInfo.selection,
        );
      } else if (
        value === undefined &&
        !selection.skippedFields?.has(fieldInfo)
      ) {
        fieldValue = createCompositeUndefinedChunk(
          context.operation,
          fieldInfo.selection,
        );
        // Missing field
        chunk.missingFields ??= new Set();
        chunk.missingFields.add(fieldInfo);
        markAsPartial(context, parent);
        context.incompleteChunks.add(chunk);
      } else {
        continue;
      }
      entryParentInfo.value = fieldValue;
      chunk.fieldChunks.set(fieldInfo.dataKey, entryParentInfo);
    }
  }
  return chunk;
}

function indexSourceList(
  context: Context,
  list: SourceCompositeList,
  selection: PossibleSelections,
  parent: GraphChunkReference,
) {
  const recycleTree = context.recycleTree;
  const recyclable =
    recycleTree?.dataMap.get(list) ?? recycleTree?.prev?.dataMap.get(list);

  if (recyclable) {
    return reIndexList(context, recyclable.value as CompositeListChunk, parent);
  }

  const { operation, dataMap } = context;
  dataMap.set(list, parent);

  const chunk = createCompositeListChunk(operation, selection, list);
  for (const [index, value] of list.entries()) {
    const itemParent = {
      value: null as any,
      parent: chunk,
      index,
    };
    let item;
    if (Array.isArray(value)) {
      item = indexSourceList(context, value, selection, itemParent);
    } else if (isSourceObject(value)) {
      item = indexSourceObject(context, value, selection, itemParent);
    } else if (value === null) {
      item = createCompositeNullChunk(operation, selection);
    } else {
      // ApolloCompat: unexpected values are converted to empty objects 🤷‍♂️
      // FIXME: remove this garbage in the next major
      const fixedValue = Object.create(null) as SourceObject;
      if (!Object.isFrozen(list)) {
        list[index] = fixedValue;
      }
      item = indexSourceObject(context, fixedValue, selection, itemParent);
      item.missingFields = new Set([...item.selection.fields.values()].flat());
      markAsPartial(context, itemParent);
      context.incompleteChunks.add(item);
    }
    itemParent.value = item;
    chunk.itemChunks[index] = itemParent;
  }
  return chunk;
}

function reIndexObject(
  context: Context,
  recyclable: ObjectChunk,
  parent: GraphChunkReference,
) {
  const { dataMap, nodes, typeMap } = context;
  dataMap.set(recyclable.data, parent);

  if (recyclable.type) {
    accumulate(typeMap, recyclable.type, recyclable);
  }
  if (recyclable.key !== false) {
    accumulate(nodes, recyclable.key, recyclable);
  }

  for (const fieldRef of recyclable.fieldChunks.values()) {
    const fieldChunk = fieldRef.value;
    if (
      fieldChunk?.kind === ValueKind.Object ||
      fieldChunk?.kind === ValueKind.CompositeList
    ) {
      if (fieldChunk.kind === ValueKind.Object) {
        reIndexObject(context, fieldChunk, fieldRef);
      } else {
        reIndexList(context, fieldChunk, fieldRef);
      }
    }
  }
  return recyclable;
}

function reIndexList(
  context: Context,
  recyclable: CompositeListChunk,
  parent: GraphChunkReference,
) {
  const { dataMap } = context;
  dataMap.set(recyclable.data, parent);

  for (const itemRef of recyclable.itemChunks.values()) {
    const itemChunk = itemRef.value;
    if (
      itemChunk?.kind === ValueKind.Object ||
      itemChunk?.kind === ValueKind.CompositeList
    ) {
      if (itemChunk.kind === ValueKind.Object) {
        reIndexObject(context, itemChunk, itemRef);
      } else {
        reIndexList(context, itemChunk, itemRef);
      }
    }
  }
  return recyclable;
}
