import type {
  ArgumentValues,
  ASTReference,
  Directives,
  FieldInfo,
  FieldMap,
  KeySpecifier,
  NormalizedFieldEntry,
  OperationDescriptor,
  PossibleSelections,
  ResolvedSelection,
  TypeName,
  VariableValues,
} from "./types";
import type {
  ArgumentNode,
  BooleanValueNode,
  DirectiveNode,
  SelectionNode,
  ValueNode,
  VariableNode,
} from "graphql";
import { valueFromASTUntyped } from "graphql";
import { isEqual } from "lodash";
import { assert } from "../jsutils/assert";
import { createArgumentDefs } from "./possibleSelection";

const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_MAP = new Map();

/**
 * Returns selection descriptor for the provided typeName. Enriches possible selection for this type with metadata that
 * could be only resolved at runtime (using operation variables):
 *
 * - Normalizes fields and arguments
 * - Resolves directive arguments
 * - Applies skip/include directives
 */
export function resolveSelection(
  operation: OperationDescriptor,
  possibleSelections: PossibleSelections,
  typeName: TypeName | null,
): ResolvedSelection {
  let map = operation.selections.get(possibleSelections);
  if (!map) {
    map = new Map();
    operation.selections.set(possibleSelections, map);
  }
  let resolvedSelection = map.get(typeName);
  if (!resolvedSelection) {
    const selection =
      possibleSelections.get(typeName) ?? possibleSelections.get(null);
    assert(selection);

    const normalizedFields = selection.fieldsToNormalize?.length
      ? normalizeFields(operation, selection.fieldsToNormalize, typeName)
      : undefined;

    const skippedFields = selection.fieldsWithDirectives?.length
      ? new Set(
          selection.fieldsWithDirectives.filter(
            (field) =>
              !shouldInclude(field.__refs, operation.variablesWithDefaults),
          ),
        )
      : undefined;

    const skippedSpreads = selection.spreadsWithDirectives?.length
      ? new Set(
          [...selection.spreadsWithDirectives.values()].filter(
            (spread) =>
              !shouldInclude(spread.__refs, operation.variablesWithDefaults),
          ),
        )
      : undefined;

    const fieldQueue = skippedFields?.size
      ? selection.fieldQueue.filter((field) => !skippedFields.has(field))
      : selection.fieldQueue;

    resolvedSelection =
      normalizedFields ||
      skippedFields?.size ||
      skippedSpreads?.size ||
      fieldQueue !== selection.fieldQueue
        ? {
            ...selection,
            fieldQueue,
            normalizedFields,
            skippedFields,
            skippedSpreads,
          }
        : selection;

    map.set(typeName, resolvedSelection);
  }
  return resolvedSelection;
}

export function resolvedSelectionsAreEqual(
  a: ResolvedSelection,
  b: ResolvedSelection,
) {
  if (a === b) {
    return true;
  }
  if (a.fields !== b.fields) {
    // Note: this will always return false for operations with different documents.
    //   E.g. "query A { foo }" and "query B { foo }" have the same selection, but will return `false` here.
    //   This is OK for our current purposes with current perf requirements.
    return false;
  }
  if (a.skippedFields?.size !== b.skippedFields?.size) {
    return false;
  }
  assert(a.normalizedFields?.size === b.normalizedFields?.size);

  const aNormalizedFields = a.normalizedFields?.entries() ?? EMPTY_ARRAY;
  for (const [alias, aNormalized] of aNormalizedFields) {
    const bNormalized = b.normalizedFields?.get(alias);
    assert(aNormalized && bNormalized);
    if (!fieldEntriesAreEqual(aNormalized, bNormalized)) {
      return false;
    }
  }
  for (const aSkipped of a.skippedFields ?? EMPTY_ARRAY) {
    if (!b.skippedFields?.has(aSkipped)) {
      return false;
    }
  }
  // FIXME: this is not enough, we must also check all child selections are equal. It requires some descriptor-level
  //   aggregation of all possible fields / directives with variables
  return true;
}

export function resolveNormalizedField(
  selection: ResolvedSelection,
  field: FieldInfo,
): NormalizedFieldEntry {
  if (!field.args) {
    return field.name;
  }
  const normalizedField = selection.normalizedFields?.get(field);
  assert(normalizedField);
  return normalizedField;
}

export function getFieldName(fieldEntry: NormalizedFieldEntry): string {
  return typeof fieldEntry === "string" ? fieldEntry : fieldEntry.name;
}

export function getFieldArgs(
  fieldEntry: NormalizedFieldEntry,
): ArgumentValues | undefined {
  return typeof fieldEntry === "string" ? undefined : fieldEntry.args;
}

function normalizeFields(
  operation: OperationDescriptor,
  fields: FieldInfo[],
  typeName: string | null,
): Map<FieldInfo, NormalizedFieldEntry> {
  const normalizedFields = new Map();
  for (const field of fields) {
    normalizedFields.set(field, normalizeField(operation, field, typeName));
  }
  return normalizedFields;
}

function normalizeField(
  operation: OperationDescriptor,
  field: FieldInfo,
  typeName: string | null,
): NormalizedFieldEntry {
  const variables = operation.variablesWithDefaults;
  const args = resolveFieldArguments(field, variables);

  const directives = resolveDirectiveValues(
    field.__refs.flatMap((f) => f.node.directives ?? EMPTY_ARRAY),
    variables,
  );
  const canHaveKeyArgs =
    typeName !== null && (args || directives?.has("connection"));

  const keyArgs = canHaveKeyArgs
    ? operation.env.keyArgs?.(typeName, field.name, args, directives, operation)
    : undefined;

  return args || keyArgs
    ? {
        name: field.name,
        args: args ?? new Map(),
        keyArgs,
      }
    : field.name;
}

function resolveFieldArguments(
  field: FieldInfo,
  variables: VariableValues,
): ArgumentValues | undefined {
  return field.args ? resolveArgumentValues(field.args, variables) : undefined;
}

function resolveArgumentValues(
  argDefinitions: Map<string, ValueNode>,
  variables: VariableValues,
): ArgumentValues {
  const argValues = new Map();
  for (const [name, value] of argDefinitions.entries()) {
    const resolvedValue = valueFromASTUntyped(value, variables);
    if (resolvedValue !== undefined) {
      argValues.set(name, resolvedValue);
    }
  }
  return argValues;
}

export function resolveFieldDataKey(
  fieldMap: FieldMap,
  field: NormalizedFieldEntry,
  variables: VariableValues,
): string | undefined {
  const fieldName = getFieldName(field);
  const fieldArgs = getFieldArgs(field);
  const fieldEntries = fieldMap.get(fieldName);
  if (!fieldEntries?.length) {
    return undefined;
  }
  if (fieldEntries.length === 1 && !fieldEntries[0].args && !fieldArgs) {
    return fieldEntries[0].dataKey;
  }
  for (const fieldInfo of fieldEntries) {
    const args = resolveFieldArguments(fieldInfo, variables);
    if (
      argumentsAreEqual(fieldArgs, args) &&
      shouldInclude(fieldInfo.__refs, variables)
    ) {
      return fieldInfo.dataKey;
    }
  }
  return undefined;
}

export function fieldEntriesAreEqual(
  a: NormalizedFieldEntry,
  b: NormalizedFieldEntry,
): boolean {
  if (typeof a === "string" || typeof b === "string") {
    return a === b;
  }
  if (typeof a.keyArgs === "string" || typeof b.keyArgs === "string") {
    // Key comparison
    return a.keyArgs === b.keyArgs;
  }
  if ((a.keyArgs || b.keyArgs) && !isEqual(a.keyArgs, b.keyArgs)) {
    return false;
  }
  return (
    getFieldName(a) === getFieldName(b) &&
    argumentsAreEqual(getFieldArgs(a), getFieldArgs(b), a.keyArgs)
  );
}

function argumentsAreEqual(
  a: ArgumentValues | undefined,
  b: ArgumentValues | undefined,
  keyArgs?: KeySpecifier,
): boolean {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  if (!keyArgs && a.size !== b.size) {
    return false;
  }
  for (const name of keyArgs ?? a.keys()) {
    if (!isEqual(a.get(name), b.get(name))) {
      return false;
    }
  }
  return true;
}

function resolveDirectiveValues(
  directives: DirectiveNode[],
  variables: VariableValues,
): Directives {
  return new Map(
    directives.map((directive) => [
      directive.name.value,
      {
        args: directive.arguments?.length
          ? resolveArgumentValues(
              createArgumentDefs(directive.arguments),
              variables,
            )
          : EMPTY_MAP,
      },
    ]),
  );
}

function shouldInclude(
  nodes: ASTReference[] | undefined,
  variables?: Record<string, any>,
): boolean {
  if (!nodes?.length) {
    return false;
  }
  return nodes.some(
    (ref) =>
      shouldIncludeImpl(ref.node, variables) &&
      ref.ancestors.every((spread) => shouldIncludeImpl(spread, variables)),
  );
}

function shouldIncludeImpl(
  { directives }: SelectionNode,
  variables?: Record<string, any>,
): boolean {
  if (!directives || !directives.length) {
    return true;
  }
  return getInclusionDirectives(directives).every(
    ({ directive, ifArgument }) => {
      let evaledValue = false;
      if (ifArgument.value.kind === "Variable") {
        evaledValue =
          (variables &&
            variables[(ifArgument.value as VariableNode).name.value]) ??
          false; // coercing nullish-value to false
      } else {
        evaledValue = (ifArgument.value as BooleanValueNode).value;
      }
      return directive.name.value === "skip" ? !evaledValue : evaledValue;
    },
  );
}

function getInclusionDirectives(
  directives: ReadonlyArray<DirectiveNode>,
): InclusionDirectives {
  const result: InclusionDirectives = [];

  if (directives && directives.length) {
    directives.forEach((directive) => {
      if (!isInclusionDirective(directive)) return;

      const directiveArguments = directive.arguments;
      assert(directiveArguments && directiveArguments.length === 1);

      const ifArgument = directiveArguments![0];
      assert(ifArgument.name && ifArgument.name.value === "if");

      const ifValue: ValueNode = ifArgument.value;

      // means it has to be a variable value if this is a valid @skip or @include directive
      assert(
        ifValue &&
          (ifValue.kind === "Variable" || ifValue.kind === "BooleanValue"),
      );
      result.push({ directive, ifArgument });
    });
  }

  return result;
}

function isInclusionDirective({ name: { value } }: DirectiveNode): boolean {
  return value === "skip" || value === "include";
}

type InclusionDirectives = Array<{
  directive: DirectiveNode;
  ifArgument: ArgumentNode;
}>;
