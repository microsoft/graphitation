import type { DocumentNode } from "@apollo/client";
import type {
  Reference,
  StoreObject,
  StoreValue,
} from "@apollo/client/utilities";
import type {
  FieldFunctionOptions,
  FieldMergeFunction,
  FieldReadFunction,
} from "@apollo/client/cache/inmemory/policies";
import { isReference, TypePolicy } from "@apollo/client";
import type { ReadFieldOptions } from "@apollo/client/cache/core/types/common";
import type {
  FieldInfo,
  NodeKey,
  NormalizedFieldEntry,
  OperationDescriptor,
  ResolvedSelection,
  TypeName,
} from "../descriptor/types";
import type {
  FieldName,
  GraphChunk,
  IncompleteValues,
  ObjectChunk,
  SourceCompositeList,
  SourceObject,
} from "../values/types";
import { ValueKind } from "../values/types";
import { assert } from "../jsutils/assert";
import {
  createDraft,
  findClosestNode,
  getGraphValueReference,
  hydrateDraft,
  isCompatibleValue,
  isComplexScalarValue,
  isCompositeListValue,
  isCompositeNullValue,
  isCompositeUndefinedValue,
  isMissingValue,
  isObjectValue,
  isScalarValue,
  isSourceObject,
  resolveFieldChunk,
  resolveFieldValue,
  retrieveEmbeddedChunk,
  TraverseEnv,
} from "../values";
import { CacheEnv, DataForest, OptimisticLayer } from "./types";
import {
  createChunkMatcher,
  createChunkProvider,
  getObjectChunks,
} from "./draftHelpers";
import {
  getFieldName,
  resolvedSelectionsAreEqual,
  resolveNormalizedField,
} from "../descriptor/resolvedSelection";
import { IndexedForest, IndexedTree } from "../forest/types";
import { ConversionContext, toApolloStoreValue, toGraphValue } from "./convert";
import { transformTree } from "../forest/transformTree";
import { DiffEnv, ObjectDifference, ValueDifference } from "../diff/types";
import { diffValue } from "../diff/diffObject";
import { indexDraft } from "../forest/indexTree";
import { StoreValue as ApolloStoreValue } from "@apollo/client/utilities/graphql/storeUtils";

export type FieldContext = {
  parentKey: NodeKey | false;
  parentTypeName: string;
  parentSelection: ResolvedSelection;
  parentValue: SourceObject;
  field: FieldInfo;
};

export type FieldPolicyFunctionContext = {
  env: CacheEnv | null;
  operation: OperationDescriptor | null;
  fieldContext: FieldContext | null;
  layers: (DataForest | OptimisticLayer)[] | null;
};

export type FieldPolicyReadContext = {
  env: CacheEnv | null;
  layers: (DataForest | OptimisticLayer)[] | null;
  fieldContext?: FieldContext | null;
};

type CustomFieldFunctionOptions = FieldFunctionOptions & {
  query: DocumentNode | null;
};

const fieldPolicyContext: FieldPolicyFunctionContext = {
  env: null,
  operation: null,
  fieldContext: null,
  layers: null,
};

const EMPTY_ARRAY = Object.freeze([]);

let options: CustomFieldFunctionOptions;

export function applyReadPolicies(
  env: CacheEnv,
  layers: (DataForest | OptimisticLayer)[],
  readPoliciesMap: Map<TypeName, Map<FieldName, FieldReadFunction>>,
  tree: IndexedTree,
) {
  const conversionContext: ConversionContext = {
    env,
    operation: tree.operation,
    recyclableValues: new Map(),
    danglingReferences: new Set(),
    getChunks: createChunkProvider(layers),
    matchChunk: createChunkMatcher(layers),
  };
  const updatedTree = transformTree(
    env,
    tree,
    "DESCEND",
    { types: [...readPoliciesMap.keys()] },
    {
      getFieldQueue(
        chunk: ObjectChunk,
        previous: ObjectDifference | undefined,
      ) {
        if (previous) {
          // Another chunk of the same logical value, continue previous read
          return previous.fieldQueue;
        }
        return readPoliciesMap.get(chunk.type as string)?.keys() ?? EMPTY_ARRAY;
      },
      transformField(
        parent: ObjectChunk,
        field: FieldInfo,
        fieldValue: GraphChunk,
        fieldDiff: ValueDifference | undefined,
      ): ValueDifference | undefined {
        const readFn = readPoliciesMap
          .get(parent.type as string)
          ?.get(field.name);
        assert(readFn);

        const existing = toApolloStoreValue(conversionContext, fieldValue);
        const transformed = invokeReadFunctionSafely(
          env,
          layers,
          tree.operation,
          readFn,
          existing,
          {
            parentValue: parent.data,
            parentTypeName: parent.type as string,
            parentSelection: parent.selection,
            parentKey: parent.key,
            field: field,
          },
        );
        if (transformed === existing) {
          return fieldDiff;
        }
        const transformedValue = toGraphValue(
          conversionContext,
          fieldValue,
          transformed,
        );
        return diffValue(env, fieldValue, transformedValue, fieldDiff);
      },
    },
  );
  if (conversionContext.danglingReferences.size) {
    updatedTree.danglingReferences = conversionContext.danglingReferences;
  }
  return updatedTree;
}

export function applyMergePolicies(
  env: CacheEnv,
  layers: (DataForest | OptimisticLayer)[],
  mergePoliciesMap: Map<TypeName, Map<FieldName, FieldMergeFunction>>,
  incomingTree: IndexedTree,
  overwrite: boolean,
): IndexedTree {
  const findChunkInfo = (value: ApolloStoreValue | SourceObject) => {
    if (typeof value !== "object" || value === null) {
      return undefined;
    }
    const tmp = value as SourceObject | SourceCompositeList;
    return incomingTree.dataMap.get(tmp) ?? incomingTree.prev?.dataMap.get(tmp);
  };
  const conversionContext: ConversionContext = {
    env: env,
    operation: incomingTree.operation,
    getChunks: function* (ref) {
      if (typeof ref === "string") {
        yield* incomingTree.nodes.get(ref) ?? EMPTY_ARRAY;
        yield* incomingTree.prev?.nodes.get(ref) ?? EMPTY_ARRAY;
      }
      yield* getObjectChunks(layers, ref);
    },
    findChunk: (value: ApolloStoreValue) => {
      const info = findChunkInfo(value);
      return info?.value &&
        (isCompositeListValue(info.value) || isObjectValue(info.value))
        ? info.value
        : undefined;
    },
    recyclableValues: new Map(),
    danglingReferences: new Set(),
  };
  const diffEnv: DiffEnv = {
    ...env,
    allowMissingFields: true,
  };
  const pathEnv: TraverseEnv = {
    findParent: (chunk) => {
      const result = findChunkInfo(chunk.data);
      assert(result);
      return result;
    },
  };
  return transformTree(
    env,
    incomingTree,
    "ASCEND",
    { types: [...mergePoliciesMap.keys()] },
    {
      getFieldQueue(chunk, diff: ObjectDifference | undefined) {
        if (diff) {
          // Another chunk of the same logical value, continue previous merge
          return diff.fieldQueue;
        }
        return (
          mergePoliciesMap.get(chunk.type as string)?.keys() ?? EMPTY_ARRAY
        );
      },
      transformField(
        parent: ObjectChunk,
        field: FieldInfo,
        fieldValue: GraphChunk,
        fieldDiff: ValueDifference | undefined,
      ): ValueDifference | undefined {
        if (isMissingValue(fieldValue)) {
          return undefined;
        }
        let existingChunk: GraphChunk | undefined;
        if (!overwrite) {
          // Resolving "existing" value through parent, because field value may not have metadata, e.g. be a scalar
          const existingParent =
            findExistingChunk(pathEnv, incomingTree, parent) ??
            findChunk(pathEnv, layers, parent);

          existingChunk = existingParent
            ? resolveFieldChunk(existingParent, field)
            : materializeFromForest(env, pathEnv, layers, parent, field);

          if (existingChunk !== undefined) {
            assert(isCompatibleValue(fieldValue, existingChunk));
          }
        }
        const mergeFn = mergePoliciesMap
          .get(parent.type as string)
          ?.get(field.name);
        assert(mergeFn);

        const incoming = toApolloStoreValue(conversionContext, fieldValue);
        const existing = existingChunk
          ? toApolloStoreValue(conversionContext, existingChunk)
          : undefined;

        const merged = invokeMergeFunctionSafely(
          env,
          layers,
          incomingTree.operation,
          mergeFn,
          existing,
          incoming,
          {
            parentValue: parent.data,
            parentTypeName: parent.type as string,
            parentSelection: parent.selection,
            parentKey: parent.key,
            field: field,
          },
        );
        if (incoming === merged) {
          return fieldDiff;
        }
        const value =
          merged === existing && existingChunk
            ? existingChunk
            : toGraphValue(conversionContext, fieldValue, merged);

        return diffValue(diffEnv, fieldValue, value);
      },
    },
  );
}

function materializeFromForest(
  env: CacheEnv,
  pathEnv: TraverseEnv,
  layers: (DataForest | OptimisticLayer)[],
  parentChunk: ObjectChunk,
  field: FieldInfo,
): GraphChunk | undefined {
  const source: SourceObject = {} as SourceObject;
  const draft = hydrateDraft(
    env,
    createDraft(
      parentChunk.operation,
      parentChunk.possibleSelections,
      getGraphValueReference(pathEnv, parentChunk),
      parentChunk.type,
      source,
      new Map([[source, [field]]]) as IncompleteValues, // This ensures we hydrate only this single field
    ),
    createChunkProvider(layers),
    createChunkMatcher(layers),
  );
  const object = indexDraft(env, draft);
  return object.kind === ValueKind.Object
    ? resolveFieldChunk(object, field)
    : undefined;
}

export function invokeReadFunctionSafely(
  env: CacheEnv,
  layers: (DataForest | OptimisticLayer)[],
  operation: OperationDescriptor,
  readFn: FieldReadFunction,
  existing: StoreValue,
  fieldContext: FieldContext,
): StoreValue {
  try {
    // fieldPolicyContext.readFieldContext = info;
    fieldPolicyContext.env = env;
    fieldPolicyContext.layers = layers;
    fieldPolicyContext.operation = operation;
    fieldPolicyContext.fieldContext = fieldContext;

    const value = readFn(
      existing,
      prepareFieldPolicyOptions.call(fieldPolicyContext),
    );
    assertValidValue(fieldContext, value, existing);
    return value;
  } catch (e) {
    console.log("Read function error:", e);
    return existing;
  } finally {
    fieldPolicyContext.env = null;
    fieldPolicyContext.layers = null;
    fieldPolicyContext.operation = null;
    fieldPolicyContext.fieldContext = null;
  }
}

export function invokeMergeFunctionSafely(
  env: CacheEnv,
  layers: (DataForest | OptimisticLayer)[],
  operation: OperationDescriptor,
  mergeFn: FieldMergeFunction,
  existing: StoreValue | undefined,
  incoming: StoreValue | undefined,
  fieldContext: FieldContext,
): ReturnType<FieldMergeFunction> {
  try {
    fieldPolicyContext.env = env;
    fieldPolicyContext.layers = layers;
    fieldPolicyContext.operation = operation;
    fieldPolicyContext.fieldContext = fieldContext;

    return mergeFn(
      existing,
      incoming,
      prepareFieldPolicyOptions.call(fieldPolicyContext),
    );
  } catch (e) {
    console.log("Merge function error:", e);
    return fieldContext.parentValue[fieldContext.field.dataKey];
  } finally {
    fieldPolicyContext.env = null;
    fieldPolicyContext.layers = null;
    fieldPolicyContext.operation = null;
    fieldPolicyContext.fieldContext = null;
  }
}

function assertValidValue(
  fieldContext: FieldContext,
  userValue: StoreValue,
  existing: StoreValue,
) {
  if (userValue === null || userValue === undefined) {
    return;
  }
  if (userValue instanceof Date) {
    // ApolloCompat
    // Special case of converting dates for convenience
    return;
  }
  if (!fieldContext.field.selection) {
    // Could be anything due to custom scalars, so can do little here
    if (
      existing !== null &&
      existing !== undefined &&
      (typeof existing !== typeof userValue ||
        (Array.isArray(existing) && !Array.isArray(userValue)))
    ) {
      throw new Error(
        `Read policy for ${fieldContext.parentTypeName}.${fieldContext.field.name}` +
          `has returned a value that has a different type than the existing value. Using old value.\n` +
          `  returned: ${JSON.stringify(userValue)}\n` +
          `  existing: ${JSON.stringify(existing)}`,
      );
    }
    return;
  }
  if (typeof userValue !== "object") {
    throw new Error(
      `Read policy for ${fieldContext.parentTypeName}.${fieldContext.field.name}` +
        `has returned unexpected non-object value: ${JSON.stringify(
          userValue,
        )}`,
    );
  }
}

function prepareFieldPolicyOptions(
  this: FieldPolicyFunctionContext,
): CustomFieldFunctionOptions {
  if (!options) {
    options = {
      args: null,
      field: null,
      fieldName: "",
      variables: {},
      isReference,
      toReference: toReference.bind(this),
      readField: readField.bind(this),
      canRead: canRead.bind(this),
      mergeObjects: mergeObjects.bind(this) as any,
      get storeFieldName(): any {
        throw new Error("Not implemented in ForestRun: storage");
      },
      get storage(): any {
        throw new Error("Not implemented in ForestRun: storage");
      },
      get cache(): any {
        throw new Error("Not implemented in ForestRun: cache");
      },
      query: null,
    };
  }
  assert(this.env && this.operation && this.fieldContext && this.layers);
  const operation = this.operation;
  const field = this.fieldContext.field;

  const fieldAST = field.__refs?.[0].node;
  const normalizedField = resolveNormalizedField(
    this.fieldContext.parentSelection,
    field,
  );
  assert(fieldAST);

  options.query = operation.document;
  options.field = fieldAST;
  options.fieldName = field.name;
  options.variables = operation.variablesWithDefaults;
  options.args =
    typeof normalizedField === "object"
      ? Object.fromEntries(normalizedField.args)
      : null;

  return options;
}

export function toReference(
  this: { env: CacheEnv | null },
  objectOrRef: string | Reference | StoreObject,
  writeToStore = false,
) {
  if (writeToStore === true) {
    throw new Error("Writing via toReference is not supported by ForestRun");
  }
  if (isReference(objectOrRef)) {
    return objectOrRef;
  }
  if (typeof objectOrRef === "string") {
    return { __ref: objectOrRef };
  }
  assert(this.env && objectOrRef);
  const id = this.env.objectKey(objectOrRef as SourceObject);
  return typeof id === "string" ? { __ref: id } : undefined;
}

export function canRead(this: FieldPolicyReadContext, objOrRef: StoreValue) {
  assert(this.layers && this.env);
  if (isReference(objOrRef)) {
    for (const layer of this.layers) {
      if (layer.operationsByNodes.has(objOrRef.__ref)) {
        return true;
      }
    }
  }
  return typeof objOrRef === "object";
}

export function readField(
  this: FieldPolicyReadContext,
  arg1: FieldName | ReadFieldOptions,
  arg2?: StoreObject | Reference,
) {
  // ApolloCompat:
  //   see issue #8499
  if (
    (typeof arg1 === "object" &&
      arg1 !== null &&
      Object.prototype.hasOwnProperty.call(arg1, "from") &&
      arg1["from"] === undefined) ||
    (arg2 === undefined && arguments.length === 2)
  ) {
    return undefined;
  }
  let options: ReadFieldOptions | undefined, fieldName, from;
  if (typeof arg1 === "object") {
    options = arg1;
    fieldName = options.fieldName;
    from = options.from;
  } else {
    fieldName = arg1;
    from = arg2;
  }

  const normalizedField: NormalizedFieldEntry = options?.args
    ? { name: fieldName, args: new Map(Object.entries(options.args)) }
    : fieldName;

  if (!from) {
    return (
      readFromParentValue(this, normalizedField) ??
      readFromOtherNodeChunks(this, normalizedField)
    );
  }
  if (isReference(from)) {
    return readFrom(this, from.__ref, normalizedField);
  }
  // FIXME: this will break with aliases (how does it even work in Apollo???)
  //   Probably try to convert to reference? (In case of Apollo this is pretty much impossible)
  return from[fieldName];
}

function readFromParentValue(
  context: FieldPolicyReadContext,
  field: NormalizedFieldEntry,
) {
  assert(context.env && context.fieldContext);
  const { parentValue, parentSelection } = context.fieldContext;
  const fieldAliases = parentSelection.fields.get(getFieldName(field));
  if (!fieldAliases?.length) {
    return undefined;
  }
  if (
    fieldAliases.length !== 1 ||
    fieldAliases[0].args ||
    typeof field !== "string"
  ) {
    throw new Error(
      "ForestRun doesn't support reads of complex fields with arguments in field policies",
    );
  }
  const fieldInfo = fieldAliases[0];
  const value = parentValue[fieldInfo.dataKey];
  return fieldInfo.selection ? maybeReturnRef(context.env, value) : value;
}

function readFromOtherNodeChunks(
  context: FieldPolicyReadContext,
  field: NormalizedFieldEntry,
) {
  assert(context.env && context.fieldContext && context.layers);
  const { parentKey } = context.fieldContext;
  assert(parentKey);

  return readFrom(context, parentKey, field);
}

function readFrom(
  context: FieldPolicyReadContext,
  ref: NodeKey,
  field: NormalizedFieldEntry,
) {
  assert(context.env && context.layers);
  for (const chunk of getObjectChunks(context.layers, ref)) {
    const value = resolveFieldValue(chunk, field);
    if (value === undefined || isMissingValue(value)) {
      continue;
    }
    if (isScalarValue(value)) {
      return value;
    }
    if (isComplexScalarValue(value)) {
      return value.data;
    }
    if (isObjectValue(value) || isCompositeListValue(value)) {
      return maybeReturnRef(context.env, value.data);
    }
    throw new Error(
      `ForestRun doesn't support reading ${value?.kind} in field policies`,
    );
  }
  return undefined;
}

export function maybeReturnRef(env: CacheEnv, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => maybeReturnRef(env, item));
  }
  if (isSourceObject(value)) {
    const id = env.objectKey(value);
    return typeof id === "string" ? { __ref: id } : value;
  }
  return value;
}

function mergeObjects(
  this: FieldPolicyFunctionContext,
  existing: unknown,
  incoming: unknown,
) {
  if (Array.isArray(existing) || Array.isArray(incoming)) {
    throw new Error("Cannot automatically merge arrays");
  }
  if (isSourceObject(existing) && isSourceObject(incoming)) {
    const eType = existing?.__typename;
    const iType = incoming?.__typename;
    const typesDiffer = eType && iType && eType !== iType;
    if (typesDiffer) {
      return incoming;
    }
    if (isReference(existing) && storeValueIsStoreObject(incoming)) {
      return existing;
    }
    if (storeValueIsStoreObject(existing) && isReference(incoming)) {
      return incoming;
    }
    if (
      storeValueIsStoreObject(existing) &&
      storeValueIsStoreObject(incoming)
    ) {
      return { ...existing, ...incoming };
    }
  }
  return incoming;
}

function storeValueIsStoreObject(value: unknown): value is StoreObject {
  return isSourceObject(value) && !isReference(value) && !Array.isArray(value);
}

export function getReadPolicyFn(
  fieldPolicies: TypePolicy["fields"],
  fieldName: string,
): FieldReadFunction | undefined {
  if (!fieldPolicies) {
    return undefined;
  }
  const fieldPolicy = fieldPolicies?.[fieldName];
  if (!fieldPolicy) {
    return undefined;
  }
  return typeof fieldPolicy === "function" ? fieldPolicy : fieldPolicy.read;
}

export function getMergePolicyFn(
  fieldPolicies: TypePolicy["fields"],
  fieldName: string,
): FieldMergeFunction | undefined {
  if (!fieldPolicies) {
    return undefined;
  }
  const fieldPolicy = fieldPolicies?.[fieldName];
  if (!fieldPolicy) {
    return undefined;
  }
  return typeof fieldPolicy === "object" &&
    typeof fieldPolicy.merge === "function"
    ? fieldPolicy.merge
    : undefined;
}

function findExistingChunk(
  pathEnv: TraverseEnv,
  incomingTree: IndexedTree,
  referenceChunk: ObjectChunk, // chunk from another operation with the same document
): ObjectChunk | undefined {
  const existingTree = incomingTree.prev;
  if (!existingTree) {
    return undefined;
  }
  assert(existingTree.operation.document === referenceChunk.operation.document);
  const nodeChunk = findClosestNode(referenceChunk, pathEnv.findParent);

  // FIXME: it should be enough to compare possibleSelections here,
  //  as we call resolvedSelectionsAreEqual in the end anyways?
  const existingNodeChunk = existingTree.nodes
    .get(nodeChunk.key)
    ?.find((chunk) =>
      resolvedSelectionsAreEqual(chunk.selection, nodeChunk.selection),
    );
  const existingValue = existingNodeChunk
    ? retrieveEmbeddedChunk(pathEnv, existingNodeChunk, referenceChunk)
    : undefined;

  if (existingValue === undefined) {
    return undefined;
  }
  assert(
    isObjectValue(existingValue) ||
      isCompositeNullValue(existingValue) ||
      isCompositeUndefinedValue(existingValue),
  );
  return isObjectValue(existingValue) &&
    resolvedSelectionsAreEqual(
      existingValue.selection,
      referenceChunk.selection,
    )
    ? existingValue
    : undefined;
}

function findChunk(
  pathEnv: TraverseEnv,
  layers: IndexedForest[],
  incomingChunk: ObjectChunk,
): ObjectChunk | undefined {
  const nodeChunk = findClosestNode(incomingChunk, pathEnv.findParent);
  const ref = getGraphValueReference(pathEnv, incomingChunk);

  for (const chunk of getObjectChunks(layers, ref, false, nodeChunk)) {
    if (resolvedSelectionsAreEqual(chunk.selection, incomingChunk.selection)) {
      return chunk;
    }
  }
  return undefined;
}
