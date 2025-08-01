"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDraft = createDraft;
exports.hydrateDraft = hydrateDraft;
exports.incompleteToMissing = incompleteToMissing;
const graphql_1 = require("graphql");
const types_1 = require("./types");
const execute_1 = require("./execute");
const assert_1 = require("../jsutils/assert");
const resolve_1 = require("./resolve");
const predicates_1 = require("./predicates");
const resolvedSelection_1 = require("../descriptor/resolvedSelection");
const iterator_1 = require("./iterator");
const traverse_1 = require("./traverse");
const delete_1 = require("./delete");
const ROOT_TYPES = ["Query", "Subscription", "Mutation"];
function createDraft(operation, possibleSelections, ref, typeName, source, incompleteValues) {
    const isRoot = ref !== false && operation.rootNodeKey === (0, traverse_1.resolveObjectKey)(ref);
    if (typeof ref === "object" && ref[0].value && (0, predicates_1.isNodeValue)(ref[0].value)) {
        ref = ref[0].value.key;
    }
    // ApolloCompat:
    // See src/cache/inmemory/readFromStore.ts:355
    source ?? (source = !isRoot ||
        isFragmentDocument(operation) ||
        ROOT_TYPES.includes(operation.rootType)
        ? undefined
        : { __typename: operation.rootType });
    return {
        kind: types_1.ValueKind.ObjectDraft,
        operation,
        possibleSelections,
        selection: (0, resolvedSelection_1.resolveSelection)(operation, possibleSelections, typeName || null),
        type: typeName,
        ref,
        data: source,
        incompleteValues,
        missingFields: undefined, // this includes deleted fields as a part of eviction
        dangling: false,
    };
}
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
function hydrateDraft(env, draft, chunkProvider, chunkMatcher, enterObject) {
    // Need actual root chunk for proper typeName resolution at the very root
    const chunks = typeof chunkProvider === "function"
        ? draft.ref !== false
            ? chunkProvider(draft.ref)
            : []
        : getChunks(chunkProvider);
    const [rootChunk] = chunks;
    if (!rootChunk) {
        draft.data ?? (draft.data = {});
        draft.missingFields ?? (draft.missingFields = getMissingDraftFields(draft));
        draft.dangling = draft.ref !== false && (0, traverse_1.isNodeRef)(draft.ref); // embedded objects are not considered dangling refs
        return draft;
    }
    const missingFields = new Map();
    const { data, incompleteValues } = (0, execute_1.execute)(draft.operation, draft.possibleSelections, rootChunk, draft, {
        resolveType(model) {
            return model.type;
        },
        enterList(model, _possibleSelections, _firstVisit) {
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
        enterObject(model, selection, firstVisit, output) {
            if (enterObject) {
                enterObject(selection, model, output);
            }
            if (firstVisit) {
                const match = typeof chunkMatcher === "function" && model.key !== false
                    ? chunkMatcher(model.key, draft.operation, selection)
                    : undefined;
                if (match && isRecyclable(match)) {
                    return (0, execute_1.completeValue)(match.data);
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
        resolveField(model, field, selection, currentValue) {
            const value = (0, resolve_1.aggregateFieldValue)(model, (0, resolvedSelection_1.resolveNormalizedField)(selection, field));
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
                return value;
            }
            if (typeof value !== "object") {
                if (field.selection) {
                    throw unexpectedSelectionError(draft, model, field, value);
                }
                return value;
            }
            switch (value.kind) {
                case types_1.ValueKind.Object: {
                    if (!field.selection) {
                        throw missingSelectionError(draft, model, field, value);
                    }
                    return value;
                }
                case types_1.ValueKind.CompositeList: {
                    if (!field.selection) {
                        throw missingSelectionError(draft, model, field, value);
                    }
                    return (0, iterator_1.toIterableValue)(value);
                }
                case types_1.ValueKind.CompositeNull:
                    return value.data;
                case types_1.ValueKind.LeafList:
                case types_1.ValueKind.LeafError:
                case types_1.ValueKind.ComplexScalar: {
                    if (field.selection) {
                        throw unexpectedSelectionError(draft, model, field, value);
                    }
                    return value.data;
                }
                case types_1.ValueKind.LeafUndefined:
                case types_1.ValueKind.CompositeUndefined: {
                    if (field.name === "__typename" && model.type) {
                        return model.type;
                    }
                    // Special case for "deleted" fields: skipping altogether thus excluding this field from field queue
                    //   (fields marked as deleted in higher layers shouldn't be resolved with values from lower layers)
                    if ((0, predicates_1.isDeletedValue)(value)) {
                        addMissingField(missingFields, currentValue, field);
                        return execute_1.SKIP;
                    }
                    return undefined;
                }
                default:
                    (0, assert_1.assertNever)(value);
            }
        },
    });
    if (incompleteValues?.size) {
        incompleteToMissing(incompleteValues, missingFields);
    }
    draft.data = data;
    draft.incompleteValues = incompleteValues;
    draft.missingFields = missingFields;
    return draft;
}
function unexpectedSelectionError(draft, parent, field, _value) {
    const op = draft.operation;
    const that = parent.isAggregate
        ? parent.chunks[0].operation
        : parent.operation;
    return new Error(`Unexpected selection set for field ${parent.type}.${field.name}\n` +
        `Operation: ${(0, graphql_1.print)(op.document).substring(0, 100)}\n` +
        `Conflicting operation: ${(0, graphql_1.print)(that.document).substring(0, 100)}`);
}
function missingSelectionError(draft, parent, field, value) {
    const typeName = (0, predicates_1.isCompositeListValue)(value)
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
        `${(0, graphql_1.print)(op.document).substring(0, 100)}\n\n` +
            `Conflicting operation:\n` +
            `${(0, graphql_1.print)(that.document).substring(0, 100)}`;
    return new Error(message);
}
function getFirstTypeName(listOrObj) {
    try {
        JSON.stringify(listOrObj.data, (_, value) => {
            if (typeof value === "object" && value.__typename) {
                throw value.__typename;
            }
            return value;
        });
        return undefined;
    }
    catch (typename) {
        return typename;
    }
}
function addMissingField(missingFieldsMap, source, field) {
    let missing = missingFieldsMap.get(source);
    if (!missing) {
        missing = new Set();
        missingFieldsMap.set(source, missing);
    }
    missing.add(field);
}
function resolveMissingFields(object, incompleteFields) {
    // Missing fields is a subset of incomplete fields.
    // Incomplete fields also includes fields where one of the nested objects has missing fields
    return new Set(incompleteFields.filter((f) => object[f.dataKey] === undefined));
}
function incompleteToMissing(incompleteEntries, missingFieldsMap = new Map()) {
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
function getMissingDraftFields(draft) {
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
function getChunks(value) {
    return value.isAggregate ? value.chunks : [value];
}
function isFragmentDocument(descriptor) {
    const operationDefinition = descriptor.definition;
    const selections = operationDefinition.selectionSet.selections;
    return selections.length === 1 && selections[0].kind === "FragmentSpread";
}
function isRecyclable(chunk) {
    if (chunk.missingFields?.size ||
        chunk.partialFields?.size ||
        (0, delete_1.hasDeletedField)(chunk)) {
        return false;
    }
    return true;
}
