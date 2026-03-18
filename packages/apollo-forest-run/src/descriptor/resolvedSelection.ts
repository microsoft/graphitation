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
import { equal } from "@wry/equality";
import { assert } from "../jsutils/assert";
import { createArgumentDefs } from "./possibleSelection";
import {
  hashString,
  combineHash,
  hashValue,
  UNINITIALIZED_HASH,
} from "../jsutils/selectionHash";

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

    if (hasLocalChanges || selection.hasDescendantsToResolve) {
      resolvedSelection = {
        ...selection,
        fieldQueue,
        normalizedFields,
        skippedFields,
        skippedSpreads,
        resolvedHash: UNINITIALIZED_HASH,
      };
      selectionOperations.set(resolvedSelection, operation);

      // New child may change parent hashes — invalidate existing cloned selections
      invalidateResolvedHashes(operation);
    } else {
      resolvedSelection = selection;
    }

    map.set(typeName, resolvedSelection);
  }
  return resolvedSelection;
}

/** Reset resolvedHash on cloned resolved selections for this operation.
 *  Only cloned selections (those in selectionOperations WeakMap) are operation-specific.
 *  Non-cloned selections are shared PossibleSelections whose hash is deterministic. */
function invalidateResolvedHashes(operation: OperationDescriptor): void {
  for (const typeMap of operation.selections.values()) {
    for (const sel of typeMap.values()) {
      if (
        sel.resolvedHash !== UNINITIALIZED_HASH &&
        selectionOperations.has(sel)
      ) {
        sel.resolvedHash = UNINITIALIZED_HASH;
      }
    }
  }
}

function computeResolvedHash(
  operation: OperationDescriptor | undefined,
  selection: ResolvedSelection,
): number {
  let hash = selection.structuralHash;

  // Mix in resolved arg values. When keyArgs is defined, only hash the keyArgs
  // (not all args) to match fieldEntriesAreEqual semantics — pagination args
  // like after/before/first/last should not affect selection equality.
  if (selection.normalizedFields?.size) {
    for (const [, entry] of selection.normalizedFields) {
      if (typeof entry === "string") {
        hash = combineHash(hash, hashString(entry));
      } else if (typeof entry.keyArgs === "string") {
        hash = combineHash(hash, hashString(entry.name));
        hash = combineHash(hash, hashString(entry.keyArgs));
      } else if (entry.keyArgs) {
        hash = combineHash(hash, hashString(entry.name));
        for (const k of entry.keyArgs) {
          hash = combineHash(hash, hashString(k));
          const val = entry.args.get(k);
          if (val !== undefined) hash = combineHash(hash, hashValue(val));
        }
      } else {
        hash = combineHash(hash, hashString(entry.name));
        for (const [argName, argVal] of entry.args) {
          hash = combineHash(hash, hashString(argName));
          hash = combineHash(hash, hashValue(argVal));
        }
      }
    }
  }

  // Mix in resolved non-inclusion directive values (e.g. @connection)
  if (selection.fieldsWithDirectives?.length) {
    assert(operation);
    const variables = operation.variablesWithDefaults;
    for (const field of selection.fieldsWithDirectives) {
      for (const ref of field.__refs) {
        if (!ref.node.directives) continue;
        for (const dir of ref.node.directives) {
          const name = dir.name.value;
          if (name === "skip" || name === "include") continue;
          hash = combineHash(hash, hashString(name));
          if (dir.arguments?.length) {
            for (const arg of dir.arguments) {
              hash = combineHash(hash, hashString(arg.name.value));
              const val = valueFromASTUntyped(arg.value, variables);
              hash = combineHash(hash, hashValue(val));
            }
          }
        }
      }
    }
  }

  // Mix in skipped fields
  if (selection.skippedFields?.size) {
    for (const field of selection.skippedFields) {
      hash = combineHash(hash, hashString(field.dataKey));
    }
  }

  // Mix in skipped spreads
  if (selection.skippedSpreads?.size) {
    for (const spread of selection.skippedSpreads) {
      hash = combineHash(hash, hashString(spread.name));
    }
  }

  // Mix in children hashes (including type keys)
  if (selection.fieldsWithSelections) {
    for (const fieldName of selection.fieldsWithSelections) {
      const fields = selection.fields.get(fieldName);
      if (!fields) continue;
      for (const field of fields) {
        if (!field.selection) continue;
        const resolvedMap = operation?.selections.get(field.selection);
        for (const [typeName] of field.selection) {
          // Hash type key so that different type spreads are distinguished
          if (typeName !== null) {
            hash = combineHash(hash, hashString(typeName));
          }
          // For variable-dependent selections, use operation.selections to find resolved children
          // For non-variable selections, use PossibleSelection directly (it IS the resolved selection)
          const child =
            resolvedMap?.get(typeName) ??
            (!selection.hasDescendantsToResolve
              ? field.selection.get(typeName) ?? field.selection.get(null)
              : undefined);
          if (child) {
            hash = combineHash(hash, getResolvedHash(child, operation));
          }
        }
      }
    }
  }

  return hash >>> 0;
}

/** Lazily compute resolved hash on first cross-doc comparison */
function getResolvedHash(
  selection: ResolvedSelection,
  operation?: OperationDescriptor,
): number {
  if (
    selection.resolvedHash !== undefined &&
    selection.resolvedHash !== UNINITIALIZED_HASH
  ) {
    return selection.resolvedHash;
  }
  if (
    !selection.normalizedFields &&
    !selection.skippedFields &&
    !selection.skippedSpreads &&
    !selection.fieldsWithDirectives &&
    !selection.fieldsWithSelections
  ) {
    selection.resolvedHash = selection.structuralHash;
    return selection.resolvedHash;
  }
  const op = operation ?? selectionOperations.get(selection);
  const hash = computeResolvedHash(op, selection);
  // Only cache when we have a complete picture (operation available for child hashing)
  if (op) {
    selection.resolvedHash = hash;
  }
  return hash;
}

export function resolvedSelectionsAreEqual(
  a: ResolvedSelection,
  b: ResolvedSelection,
): boolean {
  if (a === b) return true;
  if (a.structuralHash !== b.structuralHash) return false;
  return getResolvedHash(a) === getResolvedHash(b);
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
