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
  NormalizedFieldEntry,
  OperationDescriptor,
  PossibleSelections,
} from "../descriptor/types";
import type { ForestEnv, IndexedTree } from "./types";
import { ValueKind } from "../values/types";
import {
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
  findClosestNode,
  getDataPathForDebugging,
  isCompositeListValue,
  isParentListRef,
  isParentObjectRef,
  isRootRef,
  isSourceCompositeValue,
  isSourceObject,
  markAsPartial,
  resolveFieldValue,
  resolveListItemChunk,
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

  // `incompleteChunks` is per-tree state, so a recycled chunk that is still missing
  //   fields has to re-register itself - otherwise the incompleteness disappears the
  //   first time the containing tree is recycled and reads report `complete: true`.
  if (recyclable.missingFields?.size) {
    markAsPartial(context, parent);
    context.incompleteChunks.add(recyclable);
  }

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
  let reported = false;
  for (let index = 0; index < itemChunks.length; index++) {
    let itemRef = itemChunks[index];
    if (itemRef === undefined) {
      if (index >= recyclable.data.length) {
        // A slot past the end of the data it indexes: the write that *indexed* this
        //   list was malformed. Report it rather than throwing - a throw would reject
        //   every later write too, since the hole is cached and each recycle finds it.
        if (!reported) {
          reported = true;
          context.env.logger?.warn(
            malformedPayloadError(context, recyclable, parent),
          );
        }
        continue;
      }
      // `itemChunks` is allocated sparse and filled lazily, so an in-range hole only
      //   means "not resolved yet".
      resolveListItemChunk(recyclable, index);
      itemRef = itemChunks[index];
      if (itemRef === undefined) {
        continue;
      }
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

type ListFieldOccurrence = { items: number; slots: string; path: string };

/**
 * Everything printed here ships to telemetry: schema level names, data paths and item counts
 * only. Never the node key (it embeds the entity id) or argument values.
 */
function malformedPayloadError(
  context: Context,
  damaged: CompositeListChunk,
  parent: GraphChunkReference,
): string {
  // This runs while asserting, on a tree already known to be broken. A throw in here would
  // replace the invariant with an unrelated error and lose the payload description entirely,
  // so the whole description is guarded and degrades to what we can read off the chunk itself.
  try {
    return describeMalformedPayload(context, damaged, parent);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return (
      `Detected malformed payload written to the cache: a list holds fewer items than the ` +
      `chunks referencing it.\n\n` +
      `  Operation:  ${
        damaged.operation?.debugName ?? "(unknown operation)"
      }\n` +
      `  Items:      ${damaged.data?.length ?? "(unknown)"}\n\n` +
      `  (reporting failed: ${reason})`
    );
  }
}

function describeMalformedPayload(
  context: Context,
  damaged: CompositeListChunk,
  parent: GraphChunkReference,
): string {
  // The offending payload is still in the tree being recycled, so report that write, not this one.
  const tree = findIndexingTree(context, damaged);
  const findParent = createParentLocator(tree?.dataMap ?? context.dataMap);
  const owner = findOwningField(findParent, parent);
  const fieldEntry = owner
    ? resolveNormalizedField(owner.parent.selection, owner.field)
    : null;
  const fieldName = fieldEntry ? getFieldName(fieldEntry) : "(unknown field)";
  // The object owning the list may itself be embedded and keyless (a Relay connection is the
  // common case), and a keyless object cannot be repeated on its own: what occurs multiple
  // times is the closest keyed ancestor, so that is what the occurrence search is scoped to.
  const node = owner && findClosestNode(owner.parent, findParent);
  const embedded = typeof owner?.parent.key !== "string";
  const objectType = owner?.parent.type || "(unknown type)";
  const nodeType = node?.type || "(unknown type)";
  const occurrences = findOccurrences(
    tree,
    owner?.parent.type,
    fieldEntry,
    node,
    damaged,
    findParent,
  );

  // The list belongs to the node itself, or to an object embedded under it. Both report the
  // type actually declaring the field, so the embedded case has to name the node separately -
  // it is the one repeated, and the one to look for in the payload.
  const nodeIdRow: [string, string][] =
    // Occurrences are collected by node key, so they are the same entity by construction.
    occurrences.length > 1
      ? [
          [
            embedded ? "Parent node id" : "Node id",
            "same in both occurrences (not shown)",
          ],
        ]
      : [];
  const rows: [string, string][] = embedded
    ? [
        ["Operation", damaged.operation.debugName],
        ["Object type", objectType],
        ["Parent node type", nodeType],
        ...nodeIdRow,
        ["Field", fieldEntry ? describeFieldEntry(fieldEntry) : fieldName],
        // Where the object sits under the node - the data paths below cross node boundaries
        // without marking them, so this is what ties the two together.
        ["Path in node", describePath(findParent, damaged, node)],
      ]
    : [
        ["Operation", damaged.operation.debugName],
        ["Node type", nodeType],
        ...nodeIdRow,
        ["Field", fieldEntry ? describeFieldEntry(fieldEntry) : fieldName],
      ];
  // Two spaces after the longest label, matching the layout the single node branch has always used.
  const labelWidth = Math.max(...rows.map(([label]) => label.length)) + 3;

  return [
    `Detected malformed payload written to the cache: a "${objectType}" ` +
      (embedded ? `object embedded in a "${nodeType}" node ` : `node `) +
      `occurs multiple times in a single write with a different number of items ` +
      `in the "${fieldName}" list.`,
    ``,
    ...rows.map(([label, value]) => `  ${`${label}:`.padEnd(labelWidth)}${value}`), // prettier-ignore
    ``,
    ...occurrences.map(
      (occurrence, i) =>
        `  Occurrence ${i + 1}: ${occurrence.items} ` +
        `${occurrence.items === 1 ? "item" : "items"} at ${occurrence.path}` +
        occurrence.slots,
    ),
  ].join("\n");
}

// The tree that indexed the damaged chunk is the one carrying the malformed payload.
function findIndexingTree(
  context: Context,
  chunk: CompositeListChunk,
): IndexedTree | null {
  for (let tree = context.recycleTree; tree; tree = tree.prev) {
    if (tree.dataMap.has(chunk.data)) {
      return tree;
    }
  }
  return null;
}

// Occurrences of the same node holding the same list field. The object owning the list is
// often keyless (a Relay connection), so it cannot be looked up in `tree.nodes` directly:
// `typeMap` indexes every chunk by type, keyed or not, and the closest node scopes the hits
// down to the one entity that is actually repeated.
function findOccurrences(
  tree: IndexedTree | null,
  type: ObjectChunk["type"] | undefined,
  fieldEntry: NormalizedFieldEntry | null,
  node: NodeChunk | null,
  damaged: CompositeListChunk,
  findParent: ParentLocator,
): ListFieldOccurrence[] {
  const found: CompositeListChunk[] = [];
  if (tree && type && fieldEntry && node) {
    for (const chunk of tree.typeMap.get(type) ?? EMPTY_ARRAY) {
      if (findClosestNode(chunk, findParent)?.key !== node.key) {
        continue;
      }
      // Matched by normalized entry, so aliases and arguments have to line up.
      const value = resolveFieldValue(chunk, fieldEntry);
      if (value !== undefined && isCompositeListValue(value)) {
        found.push(value as CompositeListChunk);
      }
    }
  }
  const other = found.find((list) => list.data.length !== damaged.data.length);
  const occurrences = !other
    ? [damaged]
    : found.indexOf(other) < found.indexOf(damaged)
    ? [other, damaged]
    : [damaged, other];

  return occurrences.map((list) => ({
    items: list.data.length,
    slots: describeSlots(list),
    path: describePath(findParent, list),
  }));
}

/**
 * The corruption inflates `itemChunks` past the payload length, so the surplus slots tell us how
 * long the *other* occurrence was even when the search cannot find it. Contiguous holes from zero
 * point at an aggregate overrun, sparse or offset ones at a stale layout.
 */
function describeSlots(list: CompositeListChunk): string {
  const slots = list.itemChunks.length;
  if (slots === list.data.length) {
    return "";
  }
  const holes: number[] = [];
  for (let i = 0; i < slots; i++) {
    if (list.itemChunks[i] === undefined) {
      holes.push(i);
    }
  }
  return ` (${slots} slots, holes at ${
    holes.length ? holes.join(",") : "none"
  })`;
}

// A list of lists has no field of its own: walk up to the field the outermost list is assigned to.
function findOwningField(
  findParent: ParentLocator,
  parent: GraphChunkReference,
): ObjectFieldReference | null {
  let ref = parent;
  while (isParentListRef(ref)) {
    ref = findParent(ref.parent);
  }
  return isParentObjectRef(ref) ? ref : null;
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

// Absolute when `from` is omitted, node relative otherwise.
function describePath(
  findParent: ParentLocator,
  list: CompositeListChunk,
  from?: ObjectChunk | CompositeListChunk | null,
): string {
  const path = getDataPathForDebugging({ findParent }, list, from ?? undefined);
  return from ? path.join(".") : `data${path.map((s) => `.${s}`).join("")}`;
}
