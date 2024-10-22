/**
 * Converts between Apollo and ForestRun values.
 * Necessary to support imperative Apollo APIs, such as field policies, `cache.modify`, `cache.evict`, etc.
 */
import type {
  Reference as ApolloReference,
  StoreValue as ApolloStoreValue,
} from "@apollo/client/utilities";
import type {
  ChunkMatcher,
  ChunkProvider,
  ComplexLeafValue,
  CompositeListChunk,
  CompositeUndefinedChunk,
  CompositeValueChunk,
  GraphChunk,
  ObjectChunk,
  ScalarValue,
  SourceCompositeList,
  SourceCustomScalar,
  SourceLeafList,
  SourceNull,
  SourceObject,
  SourceScalar,
} from "../values/types";
import type {
  OperationDescriptor,
  PossibleSelections,
} from "../descriptor/types";
import type { CacheEnv } from "./types";
import { isReference, isReference as isApolloReference } from "@apollo/client";
import * as Value from "../values";
import { ValueKind } from "../values/types";
import { assert } from "../jsutils/assert";
import { indexDraft } from "../forest/indexTree";
import { resolveSelection } from "../descriptor/resolvedSelection";

export type ConversionContext = {
  env: CacheEnv;
  operation: OperationDescriptor;
  recyclableValues: Map<ApolloStoreValue, CompositeValueChunk>;
  danglingReferences: Set<string>;
  getChunks: ChunkProvider;
  matchChunk?: ChunkMatcher; // FIXME: remove (useless when not using hydrateDraft)
  findChunk?: (
    value: ApolloStoreValue,
  ) => ObjectChunk | CompositeListChunk | undefined;
};

export type StoreObject = { __typename?: string; [key: string]: unknown };

const EMPTY_ARRAY = Object.freeze([]);

export function toApolloStoreValue(
  context: ConversionContext,
  value: GraphChunk,
): ApolloStoreValue {
  if (typeof value !== "object" || value === null) {
    return value;
  }
  return Value.isCompositeValue(value)
    ? convertNodesToApolloReferences(context, value)
    : value.data;
}

export function toGraphValue(
  context: ConversionContext,
  oldValue: GraphChunk,
  newValue: ApolloStoreValue,
) {
  return Value.isCompositeValue(oldValue)
    ? toGraphCompositeChunk(
        context,
        oldValue.possibleSelections,
        newValue as StoreObject,
      )
    : toGraphLeafValue(newValue);
}

export function toGraphLeafValue(
  apolloValue: unknown,
): ScalarValue | ComplexLeafValue | null {
  if (apolloValue === undefined) {
    return Value.leafUndefinedValue;
  }
  if (apolloValue === null) {
    return apolloValue as SourceNull;
  }
  if (typeof apolloValue === "object") {
    return Array.isArray(apolloValue)
      ? Value.createLeafList(apolloValue as SourceLeafList)
      : Value.createComplexScalarValue(apolloValue as SourceCustomScalar);
  }
  return Array.isArray(apolloValue)
    ? Value.createLeafList(apolloValue as SourceLeafList)
    : (apolloValue as SourceScalar);
}

export function toGraphCompositeChunk(
  context: ConversionContext,
  selections: PossibleSelections,
  apolloValue:
    | ApolloReference
    | ApolloReference[]
    | StoreObject
    | StoreObject[]
    | null
    | undefined
    | void,
): CompositeValueChunk {
  const { operation, recyclableValues, findChunk } = context;

  if (apolloValue === undefined) {
    return Value.createCompositeUndefinedChunk(operation, selections);
  }
  if (apolloValue === null) {
    return Value.createCompositeNullChunk(operation, selections);
  }
  assert(typeof apolloValue === "object");

  const value = recyclableValues.get(apolloValue);
  if (value) {
    return value;
  }
  if (isReference(apolloValue)) {
    return convertApolloReference(context, selections, apolloValue);
  }
  const recycled = findChunk?.(apolloValue);
  if (recycled) {
    return recycled;
  }
  if (Array.isArray(apolloValue)) {
    const source = new Array(apolloValue.length);
    const chunk = Value.createCompositeListChunk(
      operation,
      selections,
      source as SourceCompositeList,
    );
    const len = apolloValue.length;
    const itemChunks = chunk.itemChunks;
    for (let index = 0; index < len; index++) {
      const itemChunk = toGraphCompositeChunk(
        context,
        selections,
        apolloValue[index],
      );
      source[index] = itemChunk.data;
      itemChunks[index] = { value: itemChunk, parent: chunk, index };
    }
    return chunk;
  }
  const source = inlineAllApolloReferences(context, selections, apolloValue);
  assert(!Array.isArray(source));

  // Note: technically we can produce incomplete chunk without knowing it, but detecting missing leaf fields
  //   requires a separate pass with draft hydration, which is expensive. So here we expect policies do not
  //   produce objects with missing leaf fields. We will still detect missing fields with sub-selections
  //   (as a part of diffing).
  return Value.createObjectChunk(
    operation,
    selections,
    source,
    context.env.objectKey(source) ?? false,
  );
}

function convertApolloReference(
  context: ConversionContext,
  selections: PossibleSelections,
  reference: ApolloReference,
  assertExists = false,
): ObjectChunk | CompositeUndefinedChunk {
  const { env, operation, danglingReferences, getChunks, matchChunk } = context;

  let typeName;
  for (const chunk of getChunks(reference.__ref)) {
    if (
      chunk.operation === operation &&
      chunk.possibleSelections === selections
    ) {
      return chunk;
    }
    typeName ||= chunk.type;
  }
  if (assertExists) {
    assert(false);
  }
  if (typeName === undefined) {
    danglingReferences.add(reference.__ref);
    return Value.createCompositeUndefinedChunk(operation, selections, true);
  }
  const draft = Value.hydrateDraft(
    context.env,
    Value.createDraft(operation, selections, reference.__ref, typeName),
    getChunks,
    matchChunk,
  );
  if (draft.dangling) {
    assert(draft.ref !== false);
    const key = Value.resolveObjectKey(draft.ref);
    assert(key !== false && key !== undefined);
    danglingReferences.add(key);
  }
  return indexDraft(env, draft);
}

const isStoreObject = (
  apolloValue: ApolloStoreValue,
): apolloValue is StoreObject =>
  typeof apolloValue === "object" && apolloValue !== null;

function inlineAllApolloReferences(
  context: ConversionContext,
  possibleSelections: PossibleSelections,
  apolloValue: ApolloStoreValue,
): SourceObject | SourceCompositeList {
  if (Array.isArray(apolloValue)) {
    return apolloValue.map((item) =>
      inlineAllApolloReferences(context, possibleSelections, item),
    ) as SourceCompositeList;
  }
  assert(isStoreObject(apolloValue));

  const selection = resolveSelection(
    context.operation,
    possibleSelections,
    apolloValue.__typename ?? null,
  );
  for (const fieldName of selection.fieldsWithSelections ?? EMPTY_ARRAY) {
    const aliases = selection.fields.get(fieldName);
    for (const alias of aliases ?? EMPTY_ARRAY) {
      const fieldValue = apolloValue[alias.dataKey];
      if (isApolloReference(fieldValue)) {
        assert(alias.selection);
        const chunk = convertApolloReference(
          context,
          alias.selection,
          fieldValue,
        );
        apolloValue[alias.dataKey] = chunk.data;
      }
    }
  }
  return apolloValue as SourceObject;
}

function convertNodesToApolloReferences(
  context: ConversionContext,
  value: CompositeValueChunk,
): ApolloStoreValue {
  let result: ApolloStoreValue;
  switch (value.kind) {
    case ValueKind.CompositeList: {
      assert(value.itemChunks.length === value.data.length);
      result = value.itemChunks.map((chunk) =>
        convertNodesToApolloReferences(context, chunk.value),
      );
      break;
    }
    case ValueKind.Object: {
      // Note: technically we should recurse into object, but this is expensive, and Apollo encourages people to call
      //   "identify" on objects instead of accessing __ref directly. So even source object should suffice
      //   (assuming proper Apollo APIs usage)
      //   TODO: explore if this deoptimizes field/merge policies on connections due to not recycling nested edges chunks
      result = value.key ? { __ref: value.key } : value.data;
      break;
    }
    default:
      result = value.data;
      break;
  }
  if (typeof result === "object" && result !== null) {
    // Improve inverse conversion from ApolloStoreValue back to GraphValue by keeping mapping between produced Apollo
    // values and source chunks.
    context.recyclableValues.set(result, value);
  }
  return result;
}
