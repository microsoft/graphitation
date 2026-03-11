import type {
  ArgumentValues,
  ASTReference,
  Directives,
  FieldInfo,
  FieldMap,
  KeySpecifier,
  NormalizedFieldEntry,
  OperationDescriptor,
  PossibleSelection,
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
import { equal } from "@wry/equality";
import { assert } from "../jsutils/assert";
import { createArgumentDefs } from "./possibleSelection";

const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_MAP = new Map();

// Maps resolved selection wrappers to their source operations (for recursive child comparison)
const selectionOperations = new WeakMap<
  ResolvedSelection,
  OperationDescriptor
>();

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
    let effectiveTypeName = typeName;
    let selection =
      possibleSelections.get(typeName) ?? possibleSelections.get(null);
    assert(selection);

    // When null selection is empty but root type selection exists, fall through to it.
    // This handles queries where all fields come from typed fragment spreads (e.g. fragment F on Query).
    if (
      typeName === null &&
      selection.fields.size === 0 &&
      possibleSelections.size > 1
    ) {
      const rootSelection = possibleSelections.get(operation.rootType);
      if (rootSelection) {
        selection = rootSelection;
        effectiveTypeName = operation.rootType;
      }
    }

    const normalizedFields = selection.fieldsToNormalize?.length
      ? normalizeFields(
          operation,
          selection.fieldsToNormalize,
          effectiveTypeName,
        )
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

    const hasLocalChanges =
      normalizedFields ||
      skippedFields?.size ||
      skippedSpreads?.size ||
      fieldQueue !== selection.fieldQueue;

    if (hasLocalChanges) {
      resolvedSelection = {
        ...selection,
        fieldQueue,
        normalizedFields,
        skippedFields,
        skippedSpreads,
      };
    } else if (hasVariableDependentDescendants(selection)) {
      resolvedSelection = { ...selection, fieldQueue };
    } else {
      resolvedSelection = selection;
    }

    if (resolvedSelection !== selection) {
      selectionOperations.set(resolvedSelection, operation);
    }

    map.set(typeName, resolvedSelection);
  }
  return resolvedSelection;
}

export function resolvedSelectionsAreEqual(
  a: ResolvedSelection,
  b: ResolvedSelection,
): boolean {
  if (a === b) {
    return true;
  }
  if (a.fields === b.fields) {
    return sameDocSelectionsAreEqual(a, b);
  }
  return crossDocSelectionsAreEqual(a, b);
}

function sameDocSelectionsAreEqual(
  a: ResolvedSelection,
  b: ResolvedSelection,
): boolean {
  if (a.skippedFields?.size !== b.skippedFields?.size) {
    return false;
  }
  assert(a.normalizedFields?.size === b.normalizedFields?.size);

  for (const [alias, aNormalized] of a.normalizedFields?.entries() ??
    EMPTY_ARRAY) {
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
  // Bug 3 fix: compare skippedSpreads
  if (a.skippedSpreads?.size !== b.skippedSpreads?.size) {
    return false;
  }
  for (const aSpread of a.skippedSpreads ?? EMPTY_ARRAY) {
    if (!b.skippedSpreads?.has(aSpread)) {
      return false;
    }
  }
  // Bug 2 fix: recursively compare child selections
  const aOp = selectionOperations.get(a);
  const bOp = selectionOperations.get(b);
  if (aOp && bOp && a.fieldsWithSelections) {
    for (const fieldName of a.fieldsWithSelections) {
      const fields = a.fields.get(fieldName);
      if (!fields) continue;
      for (const field of fields) {
        if (!field.selection) continue;
        for (const typeName of field.selection.keys()) {
          const childA = resolveSelection(aOp, field.selection, typeName);
          const childB = resolveSelection(bOp, field.selection, typeName);
          if (!resolvedSelectionsAreEqual(childA, childB)) return false;
        }
      }
    }
  }
  return true;
}

// Bug 1 fix: structural comparison for cross-document selections
function crossDocSelectionsAreEqual(
  a: ResolvedSelection,
  b: ResolvedSelection,
): boolean {
  if (a.fields.size !== b.fields.size) return false;

  // Both empty: can't meaningfully compare (content may be in typed selections)
  if (a.fields.size === 0) return false;

  const aOp = selectionOperations.get(a);
  const bOp = selectionOperations.get(b);
  const aVars = aOp?.variablesWithDefaults ?? {};
  const bVars = bOp?.variablesWithDefaults ?? {};

  for (const [name, aEntries] of a.fields) {
    const bEntries = b.fields.get(name);
    if (!bEntries || aEntries.length !== bEntries.length) return false;

    for (let i = 0; i < aEntries.length; i++) {
      const aField = aEntries[i];
      const bField = bEntries[i];

      if (aField.dataKey !== bField.dataKey) return false;

      // Compare normalized entries (handles variable-dependent args)
      const aNorm = a.normalizedFields?.get(aField);
      const bNorm = b.normalizedFields?.get(bField);
      if ((aNorm === undefined) !== (bNorm === undefined)) return false;
      if (aNorm && bNorm && !fieldEntriesAreEqual(aNorm, bNorm)) return false;

      // Compare skip/include status
      if (
        (a.skippedFields?.has(aField) ?? false) !==
        (b.skippedFields?.has(bField) ?? false)
      )
        return false;

      // Compare non-inclusion directives (e.g. @customDeprecated, @connection)
      if (!fieldDirectivesMatch(aField, bField, aVars, bVars)) return false;

      // Compare child selections
      if (
        !childPossibleSelectionsAreEqual(
          aField.selection,
          bField.selection,
          aOp,
          bOp,
        )
      )
        return false;
    }
  }

  // Compare skippedSpreads by name (cross-doc SpreadInfo objects differ)
  if (a.skippedSpreads?.size !== b.skippedSpreads?.size) return false;
  if (a.skippedSpreads && b.skippedSpreads) {
    for (const aSpread of a.skippedSpreads) {
      let found = false;
      for (const bSpread of b.skippedSpreads) {
        if (aSpread.name === bSpread.name) {
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
  }

  return true;
}

function fieldDirectivesMatch(
  aField: FieldInfo,
  bField: FieldInfo,
  aVars: VariableValues,
  bVars: VariableValues,
): boolean {
  const aDirs = aField.__refs
    .flatMap((r) => r.node.directives ?? EMPTY_ARRAY)
    .filter((d: DirectiveNode) => !isInclusionDirective(d));
  const bDirs = bField.__refs
    .flatMap((r) => r.node.directives ?? EMPTY_ARRAY)
    .filter((d: DirectiveNode) => !isInclusionDirective(d));
  if (aDirs.length === 0 && bDirs.length === 0) return true;
  if (aDirs.length !== bDirs.length) return false;

  const aResolved = resolveDirectiveValues(aDirs, aVars);
  const bResolved = resolveDirectiveValues(bDirs, bVars);
  if (aResolved.size !== bResolved.size) return false;
  for (const [name, aVal] of aResolved) {
    const bVal = bResolved.get(name);
    if (!bVal) return false;
    if (!argumentsAreEqual(aVal.args, bVal.args)) return false;
  }
  return true;
}

function childPossibleSelectionsAreEqual(
  aSel: PossibleSelections | undefined,
  bSel: PossibleSelections | undefined,
  aOp: OperationDescriptor | undefined,
  bOp: OperationDescriptor | undefined,
): boolean {
  if (aSel === bSel) return true;
  if (!aSel || !bSel) return false;
  if (aSel.size !== bSel.size) return false;

  for (const [typeName] of aSel) {
    if (!bSel.has(typeName)) return false;

    if (aOp && bOp) {
      const childA = resolveSelection(aOp, aSel, typeName);
      const childB = resolveSelection(bOp, bSel, typeName);
      if (!resolvedSelectionsAreEqual(childA, childB)) return false;
    } else {
      // No operations available — pure structural comparison
      const aPossible = aSel.get(typeName)!;
      const bPossible = bSel.get(typeName)!;
      if (!fieldMapsAreStructurallyEqual(aPossible.fields, bPossible.fields))
        return false;
    }
  }
  return true;
}

function fieldMapsAreStructurallyEqual(a: FieldMap, b: FieldMap): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const [name, aEntries] of a) {
    const bEntries = b.get(name);
    if (!bEntries || aEntries.length !== bEntries.length) return false;
    for (let i = 0; i < aEntries.length; i++) {
      if (aEntries[i].dataKey !== bEntries[i].dataKey) return false;
      if (
        !childPossibleSelectionsAreEqual(
          aEntries[i].selection,
          bEntries[i].selection,
          undefined,
          undefined,
        )
      )
        return false;
    }
  }
  return true;
}

function hasVariableDependentDescendants(
  selection: PossibleSelection,
): boolean {
  if (!selection.fieldsWithSelections) return false;
  for (const fieldName of selection.fieldsWithSelections) {
    const fields = selection.fields.get(fieldName);
    if (!fields) continue;
    for (const field of fields) {
      if (!field.selection) continue;
      for (const [, childSel] of field.selection) {
        if (
          childSel.fieldsToNormalize?.length ||
          childSel.fieldsWithDirectives?.length ||
          childSel.spreadsWithDirectives?.length ||
          hasVariableDependentDescendants(childSel)
        ) {
          return true;
        }
      }
    }
  }
  return false;
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
  if ((a.keyArgs || b.keyArgs) && !equal(a.keyArgs, b.keyArgs)) {
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
    if (!equal(a.get(name), b.get(name))) {
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
