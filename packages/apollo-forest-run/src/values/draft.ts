import { print } from "graphql";
import type {
  ChunkMatcher,
  ChunkProvider,
  CompositeListValue,
  GraphValueReference,
  IncompleteValues,
  MissingFieldsMap,
  ObjectChunk,
  ObjectDraft,
  ObjectValue,
  SourceLeafValue,
  SourceObject,
} from "./types";
import type {
  DocumentDescriptor,
  FieldInfo,
  OperationDescriptor,
  PossibleSelections,
  ResolvedSelection,
  TypeName,
} from "../descriptor/types";
import { ValueKind } from "./types";
import { completeValue, execute, SKIP } from "./execute";
import { assertNever } from "../jsutils/assert";
import { aggregateFieldValue } from "./resolve";
import {
  isCompositeListValue,
  isDeletedValue,
  isNodeValue,
} from "./predicates";
import {
  resolveNormalizedField,
  resolveSelection,
} from "../descriptor/resolvedSelection";
import { IterableListValue, toIterableValue } from "./iterator";
import { isNodeRef, resolveObjectKey } from "./traverse";
import { hasDeletedField } from "./delete";

const ROOT_TYPES = ["Query", "Subscription", "Mutation"];

export function createDraft(
  operation: OperationDescriptor,
  possibleSelections: PossibleSelections,
  ref: GraphValueReference | false,
  typeName: TypeName | false,
  source?: SourceObject | undefined,
  incompleteValues?: IncompleteValues,
): ObjectDraft {
  const isRoot =
    ref !== false && operation.rootNodeKey === resolveObjectKey(ref);

  if (typeof ref === "object" && ref[0].value && isNodeValue(ref[0].value)) {
    ref = ref[0].value.key;
  }

  // ApolloCompat:
  // See src/cache/inmemory/readFromStore.ts:355
  source ??=
    !isRoot ||
    isFragmentDocument(operation) ||
    ROOT_TYPES.includes(operation.rootType)
      ? undefined
      : ({ __typename: operation.rootType } as SourceObject);

  return {
    kind: ValueKind.ObjectDraft,
    operation,
    possibleSelections,
    selection: resolveSelection(
      operation,
      possibleSelections,
      typeName || null,
    ),
    type: typeName,
    ref,
    data: source,
    incompleteValues,
    missingFields: undefined, // this includes deleted fields as a part of eviction
    dangling: false,
  };
}

type DraftEnv = {
  keyMap?: WeakMap<SourceObject, string | false>;
};

/**
 * Hydrates draft with data and updates its `incompleteFields` and `missingFields` maps
 * when some fields remain unresolved.
 *
 * Chunks from other operations are used as data source. Data from earlier chunks has priority.
 *
 * Notes:
 *
 * - A single selection may require multiple source chunks to be fully resolved.
 *
 * - Execution of the selection stops when:
 *   - all fields of the selection are fully resolved (including fields of embedded objects)
 *   - or when there are no more chunks with overlapping fields in the provider
 *
 * - If some fields of the selection were not resolved, output tree is considered incomplete.
 *   Corresponding `missingFields` entry is added to the result:
 *   - missing fields only include fields, fully missing in the result
 *   - missing fields do not include "partial" fields (fields containing nested objects with missing fields)
 */
export function hydrateDraft(
  env: DraftEnv,
  draft: ObjectDraft,
  chunkProvider: ChunkProvider | ObjectValue,
  chunkMatcher?: ChunkMatcher,
  enterObject?: (
    selection: ResolvedSelection,
    model: ObjectValue,
    data: SourceObject,
  ) => void,
): ObjectDraft {
  // Need actual root chunk for proper typeName resolution at the very root
  const chunks =
    typeof chunkProvider === "function"
      ? draft.ref !== false
        ? chunkProvider(draft.ref)
        : []
      : getChunks(chunkProvider);

  const [rootChunk] = chunks;
  if (!rootChunk) {
    draft.data ??= {} as SourceObject;
    draft.missingFields ??= getMissingDraftFields(draft);
    draft.dangling = draft.ref !== false && isNodeRef(draft.ref); // embedded objects are not considered dangling refs
    return draft;
  }
  const missingFields: MissingFieldsMap = new Map();

  const { data, incompleteValues } = execute<ObjectValue, IterableListValue>(
    draft.operation,
    draft.possibleSelections,
    rootChunk,
    draft,
    {
      resolveType(model: ObjectChunk) {
        return model.type;
      },
      enterList(
        model: IterableListValue,
        _possibleSelections: PossibleSelections,
        _firstVisit: boolean,
      ) {
        // TODO: recycle lists
        // if (
        //   firstVisit &&
        //   model.list.operation === draft.operation &&
        //   model.list.possibleSelections === possibleSelections &&
        //   canRecycle?.(model)
        // ) {
        //   return completeValue(model.list.source);
        // }
        return model.length;
      },
      enterObject(
        model: ObjectValue,
        selection: ResolvedSelection,
        firstVisit: boolean,
        output: SourceObject,
      ) {
        if (enterObject) {
          enterObject(selection, model, output);
        }
        if (firstVisit) {
          const match =
            typeof chunkMatcher === "function" && model.key !== false
              ? chunkMatcher(model.key, draft.operation, selection)
              : undefined;

          if (match && isRecyclable(match)) {
            return completeValue(match.data);
          }
        }
        if (model.key !== false) {
          // ApolloCompat:
          //   The output tree must be indexed later, but we could have lost some keyFields while reading the selection
          env.keyMap?.set(output, model.key);

          // For nodes, we want to traverse all chunks
          // (any incomplete embedded objects will be re-visited as a part of this traversal)
          return typeof chunkProvider === "function"
            ? chunkProvider(model.key)
            : getChunks(model);
        }
        // For embedded objects we don't return possible chunks, because they will be naturally
        //   visited via their parent "node" chunks
      },
      resolveField(
        model: ObjectChunk,
        field: FieldInfo,
        selection: ResolvedSelection,
        currentValue: SourceObject,
      ) {
        const value = aggregateFieldValue(
          model,
          resolveNormalizedField(selection, field),
        );
        // ApolloCompat: Apollo allows writing data that has more fields than listed in selectionSet 🤷‍
        //   So it is still possible that the field "exists" in the result, just has no corresponding
        //   entry in selectionSet. We can only allow this for scalars:
        // if (value === undefined && !field.selection) {
        //   const result = parent.source[field.name];
        //   if (typeof result !== "object" || result === null) {
        //     return result;
        //   }
        // }
        if (value === undefined || value === null) {
          return value as SourceLeafValue;
        }
        if (typeof value !== "object") {
          if (field.selection) {
            throw unexpectedSelectionError(draft, model, field, value);
          }
          return value;
        }
        switch (value.kind) {
          case ValueKind.Object: {
            if (!field.selection) {
              throw missingSelectionError(draft, model, field, value);
            }
            return value;
          }
          case ValueKind.CompositeList: {
            if (!field.selection) {
              throw missingSelectionError(draft, model, field, value);
            }
            return toIterableValue(value);
          }
          case ValueKind.CompositeNull:
            return value.data;
          case ValueKind.LeafList:
          case ValueKind.LeafError:
          case ValueKind.ComplexScalar: {
            if (field.selection) {
              throw unexpectedSelectionError(draft, model, field, value);
            }
            return value.data;
          }
          case ValueKind.LeafUndefined:
          case ValueKind.CompositeUndefined: {
            if (field.name === "__typename" && model.type) {
              return model.type;
            }
            // Special case for "deleted" fields: skipping altogether thus excluding this field from field queue
            //   (fields marked as deleted in higher layers shouldn't be resolved with values from lower layers)
            if (isDeletedValue(value)) {
              addMissingField(missingFields, currentValue, field);
              return SKIP;
            }
            return undefined;
          }
          default:
            assertNever(value);
        }
      },
    },
  );
  if (incompleteValues?.size) {
    incompleteToMissing(incompleteValues, missingFields);
  }
  draft.data = data;
  draft.incompleteValues = incompleteValues;
  draft.missingFields = missingFields;

  return draft;
}

function unexpectedSelectionError(
  draft: ObjectDraft,
  parent: ObjectValue,
  field: FieldInfo,
  _value: unknown,
) {
  const op = draft.operation;
  const that = parent.isAggregate
    ? parent.chunks[0].operation
    : parent.operation;
  return new Error(
    `Unexpected selection set for field ${parent.type}.${field.name}\n` +
      `Operation: ${print(op.document).substring(0, 100)}\n` +
      `Conflicting operation: ${print(that.document).substring(0, 100)}`,
  );
}

function missingSelectionError(
  draft: ObjectDraft,
  parent: ObjectValue,
  field: FieldInfo,
  value: CompositeListValue | ObjectValue,
) {
  const typeName = isCompositeListValue(value)
    ? getFirstTypeName(value)
    : value;
  const op = draft.operation;
  const that = parent.isAggregate
    ? parent.chunks[0].operation
    : parent.operation;

  // ApolloCompat
  let message = typeName
    ? `Missing selection set for object of type ${typeName} returned for query field ${field.name} in operation:\n`
    : `Missing selection set for list at ${parent.type}.${field.name} in operation:\n`;
  message +=
    `${print(op.document).substring(0, 100)}\n\n` +
    `Conflicting operation:\n` +
    `${print(that.document).substring(0, 100)}`;

  return new Error(message);
}

function getFirstTypeName(
  listOrObj: CompositeListValue | ObjectValue,
): ObjectValue | undefined {
  try {
    JSON.stringify(listOrObj.data, (_, value) => {
      if (typeof value === "object" && value.__typename) {
        throw value.__typename;
      }
      return value;
    });
    return undefined;
  } catch (typename) {
    return typename as ObjectValue | undefined;
  }
}

function addMissingField(
  missingFieldsMap: MissingFieldsMap,
  source: SourceObject,
  field: FieldInfo,
) {
  let missing = missingFieldsMap.get(source);
  if (!missing) {
    missing = new Set();
    missingFieldsMap.set(source, missing);
  }
  missing.add(field);
}

function resolveMissingFields(
  object: SourceObject,
  incompleteFields: FieldInfo[],
): Set<FieldInfo> {
  // Missing fields is a subset of incomplete fields.
  // Incomplete fields also includes fields where one of the nested objects has missing fields
  return new Set(
    incompleteFields.filter((f) => object[f.dataKey] === undefined),
  );
}

export function incompleteToMissing(
  incompleteEntries: IncompleteValues,
  missingFieldsMap: MissingFieldsMap = new Map(),
): MissingFieldsMap {
  for (const [entry, fields] of incompleteEntries.entries()) {
    if (Array.isArray(entry)) {
      continue;
    }
    for (const incompleteField of fields) {
      if (entry[incompleteField.dataKey] === undefined) {
        addMissingField(missingFieldsMap, entry, incompleteField);
      }
    }
  }
  return missingFieldsMap;
}

function getMissingDraftFields(draft: ObjectDraft) {
  const { data, incompleteValues, selection } = draft;

  if (incompleteValues) {
    return incompleteValues?.size
      ? incompleteToMissing(incompleteValues)
      : undefined;
  }
  if (!data) {
    return undefined;
  }
  return new Map([[data, resolveMissingFields(data, selection.fieldQueue)]]);
}

function getChunks(value: ObjectValue): ObjectChunk[] {
  return value.isAggregate ? value.chunks : [value];
}

function isFragmentDocument(descriptor: DocumentDescriptor) {
  const operationDefinition = descriptor.definition;
  const selections = operationDefinition.selectionSet.selections;

  return selections.length === 1 && selections[0].kind === "FragmentSpread";
}

function isRecyclable(chunk: ObjectChunk): boolean {
  if (
    chunk.missingFields?.size ||
    chunk.partialFields?.size ||
    hasDeletedField(chunk)
  ) {
    return false;
  }
  return true;
}
