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
import { hashString, combineHash, hashValue } from "../jsutils/selectionHash";

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
      };
      selectionOperations.set(resolvedSelection, operation);
    } else {
      resolvedSelection = selection;
      resolvedSelection.resolvedHash = selection.structuralHash;
    }

    map.set(typeName, resolvedSelection);
  }
  return resolvedSelection;
}

function computeResolvedHash(
  operation: OperationDescriptor,
  selection: ResolvedSelection,
): number {
  let hash = selection.structuralHash;

  // Mix in resolved arg values (handles both hardcoded and variable args)
  if (selection.normalizedFields?.size) {
    for (const [, entry] of selection.normalizedFields) {
      if (typeof entry === "string") {
        hash = combineHash(hash, hashString(entry));
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

  // Mix in child resolved hashes (only for types already resolved during traversal)
  if (selection.fieldsWithSelections) {
    for (const fieldName of selection.fieldsWithSelections) {
      const fields = selection.fields.get(fieldName);
      if (!fields) continue;
      for (const field of fields) {
        if (!field.selection) continue;
        const resolved = operation.selections.get(field.selection);
        if (resolved) {
          // Use only types that were actually encountered at runtime
          for (const [, childResolved] of resolved) {
            hash = combineHash(hash, getResolvedHash(childResolved));
          }
        } else {
          // Child not yet traversed — resolve all possible types as fallback
          for (const typeName of field.selection.keys()) {
            const childResolved = resolveSelection(
              operation,
              field.selection,
              typeName,
            );
            hash = combineHash(hash, getResolvedHash(childResolved));
          }
        }
      }
    }
  }

  return hash >>> 0;
}

/** Lazily compute resolved hash on first cross-doc comparison */
function getResolvedHash(selection: ResolvedSelection): number {
  if (selection.resolvedHash !== undefined) {
    return selection.resolvedHash;
  }
  const op = selectionOperations.get(selection);
  assert(op);
  selection.resolvedHash = computeResolvedHash(op, selection);
  return selection.resolvedHash;
}

export function resolvedSelectionsAreEqual(
  a: ResolvedSelection,
  b: ResolvedSelection,
): boolean {
  if (a === b) {
    return true;
  }
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
