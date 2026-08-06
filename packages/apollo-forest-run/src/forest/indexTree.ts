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
  ObjectFieldReference,
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
  isParentListRef,
  isParentObjectRef,
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

  const itemChunks = recyclable.itemChunks;
  for (let index = 0; index < itemChunks.length; index++) {
    const itemRef = itemChunks[index];
    if (itemRef === undefined) {
      // Recycling is the first thing that walks every item reference of a list, so a hole left
      //   behind by an earlier write surfaces here rather than where it was punched.
      assert(false, corruptedListError(context, recyclable, index, parent));
    }
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

/**
 * Renders the violation. Everything printed here must be safe to ship to telemetry, so it is
 * limited to schema level information - type names, field names, response keys - plus positions
 * and item counts. In particular it must never include the node key (it embeds the entity id) or
 * argument values (they routinely carry ids, emails and free text).
 */
function corruptedListError(
  context: Context,
  list: CompositeListChunk,
  missingIndex: number,
  parent: GraphChunkReference,
): string {
  const owner = findOwningField(context, parent);
  const typeName = owner?.parent.type || "(unknown type)";
  const fieldEntry = owner
    ? resolveNormalizedField(owner.parent.selection, owner.field)
    : null;

  return [
    `Attempting to write to a corrupted cache state: an indexed "${typeName}" list has no item ` +
      `at index ${missingIndex}. This is left behind by an earlier payload where the same node ` +
      `occurs multiple times in a single write with a different number of items in one list field.`,
    ``,
    `  Current operation:  ${context.operation.debugName}`,
    `  Indexed by:         ${list.operation.debugName}`,
    `  Node type:          ${typeName}`,
    `  Field:              ${
      fieldEntry ? describeFieldEntry(fieldEntry) : "(unknown field)"
    }`,
    `  Items:              ${list.data.length} in the list, ${list.itemChunks.length} indexed`,
    `  Path:               ${describePath(context, list, owner)}`,
  ].join("\n");
}

/**
 * Walks up through enclosing lists (a list of lists has no field of its own) to the field the
 * outermost list is assigned to.
 */
function findOwningField(
  context: Context,
  parent: GraphChunkReference,
): ObjectFieldReference | null {
  try {
    let ref = parent;
    while (isParentListRef(ref)) {
      ref = context.findParent(ref.parent);
    }
    return isParentObjectRef(ref) ? ref : null;
  } catch (e) {
    return null;
  }
}

function describeFieldEntry(fieldEntry: NormalizedFieldEntry): string {
  if (typeof fieldEntry === "string") {
    return fieldEntry;
  }
  // Argument *names* are schema, argument values are not: elide the values.
  const args = [...(fieldEntry.args?.keys() ?? [])]
    .map((name) => `${name}: ...`)
    .join(", ");
  return args ? `${fieldEntry.name}(${args})` : fieldEntry.name;
}

function describePath(
  context: Context,
  list: CompositeListChunk,
  owner: ObjectFieldReference | null,
): string {
  // Stay defensive: this runs while reporting an error, on a tree that is known to be broken.
  try {
    const path = getDataPathForDebugging(context, list);
    return path.length ? `data.${path.join(".")}` : "data";
  } catch (e) {
    return `<unknown path>.${owner?.field.dataKey ?? "<unknown field>"}`;
  }
}
