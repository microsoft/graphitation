import type {
  FieldInfo,
  OperationDescriptor,
  PossibleSelections,
  TypeName,
} from "../descriptor/types";
import type {
  ComplexScalarValue,
  CompositeListAggregate,
  CompositeListChunk,
  CompositeListValue,
  CompositeNullAggregate,
  CompositeNullChunk,
  CompositeNullValue,
  CompositeUndefinedAggregate,
  CompositeUndefinedChunk,
  CompositeUndefinedValue,
  CompositeValue,
  CompositeValueChunk,
  FormattedError,
  GraphValue,
  LeafErrorValue,
  LeafListValue,
  ObjectAggregate,
  ObjectChunk,
  ObjectValue,
  SourceCompositeList,
  SourceCompositeValue,
  SourceCustomScalar,
  SourceLeafList,
  SourceNull,
  SourceObject,
} from "./types";
import { ValueKind } from "./types";
import * as Predicates from "./predicates";
import { assert, assertNever } from "../jsutils/assert";
import { resolveSelection } from "../descriptor/resolvedSelection";

export type ChunkAccumulator = {
  obj: ObjectChunk[] | undefined;
  list: CompositeListChunk[] | undefined;
  nll: CompositeNullChunk[] | undefined;
  undef: CompositeUndefinedChunk[] | undefined;
  err: LeafErrorValue | undefined;
};

export function shouldAggregateChunks(
  value: GraphValue,
): value is CompositeValue | LeafErrorValue {
  return (
    Predicates.isCompositeValue(value) || Predicates.isLeafErrorValue(value)
  );
}

export function createChunkAccumulator(): ChunkAccumulator {
  return {
    obj: undefined,
    list: undefined,
    nll: undefined,
    undef: undefined,
    err: undefined,
  };
}
export function accumulateChunks(
  accumulator: ChunkAccumulator,
  value: CompositeValue | LeafErrorValue,
): void {
  // Taking into account the following case
  //   (first "foo" value is null because of error bubbling, but the second is actually OK)
  // ```graphql
  // {
  //     a: foo { bar }
  //     b: foo { baz }
  // }
  // ```
  //
  // ```js
  // const data = {
  //     "a": null,
  //     "b": [{ baz: "baz" }]
  // }
  // ```
  if (value === null) {
    return;
  }
  switch (value.kind) {
    case ValueKind.Object:
      return accumulateObjectChunks(accumulator, value);

    case ValueKind.CompositeList:
      return accumulateListChunks(accumulator, value);

    case ValueKind.CompositeNull:
      return accumulateNullChunks(accumulator, value);

    case ValueKind.CompositeUndefined:
      return accumulateUndefinedChunks(accumulator, value);

    case ValueKind.LeafError: {
      accumulator.err = value;
      return;
    }
    default:
      assertNever(value);
  }
}

export function createValue(
  accumulator: ChunkAccumulator,
): CompositeValue | LeafErrorValue | undefined {
  const { err, list, obj, nll, undef } = accumulator;

  if (obj) {
    assert(!list && !err);
    return obj.length === 1 && !nll && !undef
      ? obj[0]
      : createObjectAggregate(obj, nll, undef);
  }
  if (list) {
    assert(!obj && !err);

    return list.length === 1 && !nll
      ? list[0]
      : createCompositeListAggregate(list, nll);
  }
  if (nll) {
    assert(!err);
    return nll.length === 1 ? nll[0] : createCompositeNullAggregate(nll);
  }
  if (undef) {
    assert(!err);
    return undef.length === 1
      ? undef[0]
      : createCompositeUndefinedAggregate(undef);
  }
  if (err) {
    return err;
  }
  return undefined;
}

function accumulateObjectChunks(
  accumulator: ChunkAccumulator,
  value: ObjectValue,
) {
  accumulator.obj ??= [];

  if (!Predicates.isAggregate(value)) {
    accumulator.obj.push(value);
    return;
  }
  accumulator.obj.push(...value.chunks);

  if (value.nullChunks?.length) {
    accumulator.nll ??= [];
    accumulator.nll.push(...value.nullChunks);
  }
}

function accumulateListChunks(
  accumulator: ChunkAccumulator,
  value: CompositeListValue,
) {
  accumulator.list ??= [];

  if (!Predicates.isAggregate(value)) {
    accumulator.list.push(value);
    return;
  }
  accumulator.list.push(...value.chunks);

  if (value.nullChunks?.length) {
    accumulator.nll ??= [];
    accumulator.nll.push(...value.nullChunks);
  }
}

function accumulateNullChunks(
  accumulator: ChunkAccumulator,
  value: CompositeNullValue,
) {
  accumulator.nll ??= [];

  if (Predicates.isAggregate(value)) {
    accumulator.nll.push(...value.chunks);
  } else {
    accumulator.nll.push(value);
  }
}

function accumulateUndefinedChunks(
  accumulator: ChunkAccumulator,
  value: CompositeUndefinedValue,
) {
  accumulator.undef ??= [];

  if (Predicates.isAggregate(value)) {
    accumulator.undef.push(...value.chunks);
  } else {
    accumulator.undef.push(value);
  }
}

export function createLeafError(error: FormattedError): LeafErrorValue {
  return {
    kind: ValueKind.LeafError,
    data: null as SourceNull,
    error,
  };
}

export function createLeafList(source: SourceLeafList): LeafListValue {
  return {
    kind: ValueKind.LeafList,
    data: source,
  };
}

export function createObjectChunk(
  operation: OperationDescriptor,
  possibleSelections: PossibleSelections,
  source: SourceObject,
  key: string | false,
  missingFields: Set<FieldInfo> | null = null,
): ObjectChunk {
  let typeName = source.__typename;
  if (!typeName && key !== false && key === operation.rootNodeKey) {
    typeName = operation.rootType;
  }
  return {
    kind: ValueKind.Object,
    isAggregate: false,
    operation,
    data: source,
    possibleSelections,
    // TODO: resolveSelection should be passed here instead
    selection: resolveSelection(
      operation,
      possibleSelections,
      typeName || null,
    ),
    fieldChunks: new Map(),
    type: typeName ?? false,
    key,
    missingFields,
    partialFields: null,
    hasNestedReadPolicies: false,
  };
}

export function createCompositeListChunk(
  operation: OperationDescriptor,
  possibleSelections: PossibleSelections,
  source: SourceCompositeList,
): CompositeListChunk {
  return {
    kind: ValueKind.CompositeList,
    isAggregate: false,
    operation,
    data: source,
    possibleSelections,
    itemChunks: new Array(source.length),
    hasNestedReadPolicies: false,
    missingItems: null,
    partialItems: null,
  };
}

export function createCompositeNullChunk(
  operation: OperationDescriptor,
  possibleSelections: PossibleSelections,
): CompositeNullChunk {
  return {
    kind: ValueKind.CompositeNull,
    isAggregate: false,
    data: null as SourceNull,
    operation,
    possibleSelections,
  };
}

export function createCompositeUndefinedChunk(
  operation: OperationDescriptor,
  possibleSelections: PossibleSelections,
  deleted = false,
): CompositeUndefinedChunk {
  return {
    kind: ValueKind.CompositeUndefined,
    isAggregate: false,
    data: undefined,
    deleted,
    operation,
    possibleSelections,
  };
}

export function createCompositeValueChunk(
  operation: OperationDescriptor,
  possibleSelections: PossibleSelections,
  value: SourceCompositeValue,
  key?: string | false,
): CompositeValueChunk {
  if (value === null) {
    return createCompositeNullChunk(operation, possibleSelections);
  }
  if (value === undefined) {
    return createCompositeUndefinedChunk(operation, possibleSelections);
  }
  if (Array.isArray(value)) {
    return createCompositeListChunk(operation, possibleSelections, value);
  }
  if (key === undefined) {
    key = operation.env.objectKey?.(value) ?? false;
  }
  return createObjectChunk(operation, possibleSelections, value, key);
}

export function createObjectAggregate(
  chunks: ObjectChunk[],
  nullChunks?: CompositeNullChunk[],
  undefinedChunks?: CompositeUndefinedChunk[],
): ObjectAggregate {
  if (!chunks.length) {
    throw new Error("Object chunks are empty");
  }
  const chunk = chunks[0];
  return {
    kind: ValueKind.Object,
    isAggregate: true,
    data: chunk.data,
    key: chunk.key,
    type:
      chunk.type ||
      (chunks.find((chunk) => chunk.type !== false)?.type ?? false),
    chunks,
    nullChunks,
    undefinedChunks,
  };
}

export function createCompositeListAggregate(
  chunks: CompositeListChunk[],
  nullChunks?: CompositeNullChunk[],
): CompositeListAggregate {
  if (!chunks.length) {
    throw new Error("List chunks are empty");
  }
  return {
    kind: ValueKind.CompositeList,
    isAggregate: true,
    data: chunks[0].data,
    chunks,
    nullChunks,
  };
}

export function createCompositeNullAggregate(
  chunks: CompositeNullChunk[],
): CompositeNullAggregate {
  if (!chunks.length) {
    throw new Error("List chunks are empty");
  }
  return {
    kind: ValueKind.CompositeNull,
    isAggregate: true,
    data: null as SourceNull,
    chunks,
  };
}

export function createCompositeUndefinedAggregate(
  chunks: CompositeUndefinedChunk[],
): CompositeUndefinedAggregate {
  if (!chunks.length) {
    throw new Error("List chunks are empty");
  }
  return {
    kind: ValueKind.CompositeUndefined,
    isAggregate: true,
    data: undefined,
    deleted: chunks[0].deleted, // assuming _all_ deleted chunks are marked as deleted, so relying on a single chunk
    chunks,
  };
}

export function createComplexScalarValue(
  source: SourceCustomScalar,
): ComplexScalarValue {
  return {
    kind: ValueKind.ComplexScalar,
    data: source,
  };
}

export const createSourceObject = (
  typename?: TypeName | object,
): SourceObject =>
  typeof typename === "object"
    ? (typename as SourceObject)
    : ({
        __typename: typename,
      } as SourceObject);
