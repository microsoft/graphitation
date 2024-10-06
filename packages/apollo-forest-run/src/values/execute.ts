import { FieldNode } from "graphql";
import {
  FieldInfo,
  OperationDescriptor,
  PossibleSelections,
  ResolvedSelection,
  PossibleSelection,
  TypeName,
} from "../descriptor/types";
import {
  IncompleteValues,
  NestedIterable,
  SourceCompositeList,
  SourceCompositeValue,
  SourceLeafValue,
  SourceNull,
  SourceObject,
} from "./types";
import { assert } from "../jsutils/assert";
import { addTypenameToDocument } from "../descriptor/addTypenameToDocument";
import { resolveSelection } from "../descriptor/resolvedSelection";
import { isSourceCompositeValue } from "./predicates";

export type ExecutionState = {
  data: SourceObject;
  incompleteValues: IncompleteValues;
};

export type InitialState = {
  data?: SourceObject | undefined;
  incompleteValues?: IncompleteValues;
};

export type FieldQueue = FieldInfo[];
export type ObjectChunkQueue<TModel> = Iterable<TModel> & {
  update?(fields: FieldQueue): void;
};

export type Resolver<TModel, TListModel = NestedIterable<TModel>> = {
  resolveType(model: TModel): TypeName | false;

  enterObject(
    object: TModel,
    selection: ResolvedSelection,
    firstEnter: boolean,
    currentValue: SourceObject,
  ): ObjectChunkQueue<TModel> | ReturnType<typeof completeValue> | void;

  enterList(
    list: TListModel,
    possibleSelections: PossibleSelections,
    firstEnter: boolean,
  ): number | ReturnType<typeof completeValue>;

  resolveField(
    model: TModel,
    field: FieldInfo,
    selection: ResolvedSelection,
    currentValue: SourceObject,
  ): SourceLeafValue | TModel | TListModel | typeof SKIP | undefined;
};

type Context<TModel, TListModel> = {
  operation: OperationDescriptor;
  resolver: Resolver<TModel, TListModel>;
  incompleteValues: IncompleteValues;
  amend: boolean;
};

export const SKIP = {};
const EMPTY_ARRAY = Object.freeze([] as SourceCompositeValue);
const valueContainer = { value: EMPTY_ARRAY };

const ROOT_TYPES = ["Query", "Subscription", "Mutation"];
const isAdded = (ref: { node: FieldNode }) =>
  addTypenameToDocument.added(ref.node);

export function completeValue(
  value: Exclude<SourceCompositeValue, undefined>,
): typeof valueContainer {
  assert(valueContainer.value === EMPTY_ARRAY);
  valueContainer.value = value;
  return valueContainer;
}

export function execute<TModel, TListModel = NestedIterable<TModel | null>>(
  operation: OperationDescriptor,
  possibleSelections: PossibleSelections,
  rootModel: TModel,
  state: InitialState,
  resolver: Resolver<TModel, TListModel>,
): ExecutionState {
  const context: Context<TModel, TListModel> = {
    operation,
    resolver,
    incompleteValues: state?.incompleteValues ?? new Map(),
    // If incompleteValues is not passed - assuming all objects and lists are incomplete,
    //   except for "leaf" object fields defined on the source object.
    //   This will re-traverse every field, but won't overwrite existing leaf values.
    amend: Boolean(state.data && !state.incompleteValues),
  };
  const { result } = executeObjectSelection(
    context,
    possibleSelections,
    rootModel,
    state.data,
  );
  state.data = result;
  state.incompleteValues = context.incompleteValues;
  return state as ExecutionState;
}

function executeSelection<TModel, TListModel>(
  context: Context<TModel, TListModel>,
  selections: PossibleSelections,
  value: TModel | TListModel,
  draft: SourceObject | SourceCompositeList | undefined,
): { result: SourceObject | SourceCompositeList; complete: boolean } {
  if (isIterable(value)) {
    assert(!draft || Array.isArray(draft));
    return executeCompositeListSelection(
      context,
      selections,
      value as TListModel,
      draft,
    );
  }
  assert(!draft || !Array.isArray(draft));
  return executeObjectSelection(context, selections, value, draft);
}

function executeObjectSelection<TModel, TListModel>(
  context: Context<TModel, TListModel>,
  possibleSelections: PossibleSelections,
  model: TModel,
  draft: SourceObject | undefined,
): { result: SourceObject; complete: boolean } {
  const { amend, resolver, incompleteValues } = context;
  const typeName = resolver.resolveType(model);

  const selection = resolveSelection(
    context.operation,
    possibleSelections,
    typeName || null,
  );

  const firstEnter = draft === undefined;
  const source = draft ?? ({} as SourceObject);

  // TODO: we should also keep info about all visited models per `SourceObject` and do not enter the same model twice
  //   (this is possible when re-entering the same object via multiple parent chunks)
  const info = resolver.enterObject(model, selection, firstEnter, source);

  if (isCompleteValue(info)) {
    const result = getCompleteValue(info);
    assert(firstEnter && !Array.isArray(result));
    return { result, complete: true };
  }

  let incompleteFields: FieldQueue | undefined;
  if (firstEnter) {
    incompleteFields = resolveFieldQueue(selection, typeName);
  } else if (amend) {
    incompleteFields =
      incompleteValues.get(source) ?? resolveFieldQueue(selection, typeName);
  } else {
    incompleteFields = incompleteValues.get(source);
  }

  if (!incompleteFields?.length) {
    return { result: source, complete: true };
  }

  const chunks = info;
  if (!chunks) {
    incompleteFields = executeObjectChunkSelection(
      context,
      selection,
      model,
      source,
      typeName || null,
      incompleteFields,
    );
  } else {
    chunks.update?.(incompleteFields);
    for (const chunk of chunks) {
      assert(incompleteFields?.length);
      incompleteFields = executeObjectChunkSelection(
        context,
        selection,
        chunk,
        source,
        typeName || null,
        incompleteFields,
      );
      if (!incompleteFields.length) {
        break;
      }
      chunks.update?.(incompleteFields);
    }
  }
  if (incompleteFields.length) {
    incompleteValues.set(source, incompleteFields);
  } else {
    incompleteValues.delete(source);
  }
  return { result: source, complete: !incompleteFields.length };
}

function executeObjectChunkSelection<TModel, TListModel>(
  context: Context<TModel, TListModel>,
  selection: ResolvedSelection,
  chunk: TModel,
  draft: SourceObject,
  typeName: string | null,
  incompleteFields: FieldQueue,
): FieldQueue {
  const { amend, resolver } = context;

  let nextIncompleteFields: FieldInfo[] | undefined = undefined;
  for (const fieldInfo of incompleteFields) {
    if (
      amend &&
      !fieldInfo.selection &&
      draft[fieldInfo.dataKey] !== undefined
    ) {
      continue;
    }
    const value = resolver.resolveField(chunk, fieldInfo, selection, draft);

    if (value === undefined) {
      // ApolloCompat, see
      //   src/cache/inmemory/readFromStore.ts:321
      //   src/cache/inmemory/readFromStore.ts:355
      if (
        fieldInfo.name === "__typename" &&
        typeName &&
        !ROOT_TYPES.includes(typeName)
      ) {
        draft.__typename = typeName;
        continue;
      }
      if (
        selection.skippedFields?.has(fieldInfo) ||
        fieldInfo.__refs?.every(isAdded)
      ) {
        continue;
      }
      nextIncompleteFields ??= [];
      nextIncompleteFields.push(fieldInfo);
      continue;
    }
    if (value === SKIP) {
      continue;
    }
    const dataKey = fieldInfo.dataKey;

    if (!fieldInfo.selection || value === null) {
      draft[dataKey] = value as SourceLeafValue | SourceNull;
      continue;
    }

    const currentFieldDraft = draft[dataKey];
    assert(
      fieldInfo.selection &&
        isSourceCompositeValue(currentFieldDraft, fieldInfo),
    );
    const { result, complete } = executeSelection(
      context,
      fieldInfo.selection,
      value as TModel | TListModel,
      currentFieldDraft,
    );
    if (!complete) {
      nextIncompleteFields ??= [];
      nextIncompleteFields.push(fieldInfo);
    }
    if (result !== currentFieldDraft) {
      draft[dataKey] = result;
    }
  }
  return nextIncompleteFields ?? (EMPTY_ARRAY as unknown as FieldQueue);
}

function executeCompositeListSelection<TModel, TListModel>(
  context: Context<TModel, TListModel>,
  possibleSelections: PossibleSelections,
  list: TListModel,
  draft: SourceCompositeList | undefined,
): { result: SourceCompositeList; complete: boolean } {
  const { resolver, incompleteValues } = context;
  const firstEnter = draft === undefined;
  const lenOrValue = resolver.enterList(list, possibleSelections, firstEnter);

  if (isCompleteValue(lenOrValue)) {
    const result = getCompleteValue(lenOrValue);
    assert(firstEnter && Array.isArray(result));
    return { result, complete: true };
  }

  let incompleteItems: Set<number> | undefined;
  if (draft) {
    incompleteItems = incompleteValues.get(draft);
    if (!incompleteItems?.size) {
      return { result: draft, complete: true };
    }
  }
  if (!draft) {
    draft = new Array(lenOrValue);
  }
  let index = 0;
  assert(isIterable(list));
  for (const tmp of list) {
    const item: TModel | null = tmp;
    if (!firstEnter && incompleteItems && !incompleteItems.has(index)) {
      index++;
      continue;
    }
    if (item === null) {
      draft[index++] = null as SourceNull;
      continue;
    }
    const currentValue = firstEnter ? undefined : draft[index];
    const { result, complete } = executeSelection(
      context,
      possibleSelections,
      item,
      currentValue,
    );
    if (complete && incompleteItems) {
      incompleteItems.delete(index);
    }
    if (!complete) {
      incompleteItems ??= new Set();
      incompleteItems.add(index);
    }
    if (currentValue !== result) {
      draft[index] = result;
    }
    index++;
  }
  if (incompleteItems?.size) {
    incompleteValues.set(draft, incompleteItems);
  } else {
    incompleteValues.delete(draft);
  }
  return { result: draft, complete: !incompleteItems?.size };
}

function resolveFieldQueue(
  selection: PossibleSelection,
  typeName: string | false,
): FieldQueue {
  // ApolloCompat
  const fieldQueue = selection.fieldQueue;
  if (!typeName || !ROOT_TYPES.includes(typeName)) {
    return fieldQueue;
  }
  const typeNameField = selection.fields.get("__typename");
  const wasAutoAdded = typeNameField?.every((node) =>
    node.__refs?.every(isAdded),
  );
  return wasAutoAdded
    ? fieldQueue.filter((field) => field.name !== "__typename")
    : fieldQueue;
}

function isIterable(value: unknown): value is Iterable<any> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.prototype.hasOwnProperty.call(value, Symbol.iterator)
  );
}

function isCompleteValue(value: unknown): value is typeof valueContainer {
  return value === valueContainer;
}

function getCompleteValue(container: typeof valueContainer) {
  assert(container.value !== EMPTY_ARRAY);
  const value = container.value;
  container.value = EMPTY_ARRAY;
  return value as Exclude<SourceCompositeValue, undefined>;
}
