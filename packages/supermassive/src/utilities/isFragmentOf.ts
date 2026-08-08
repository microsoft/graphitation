import {
  SchemaDefinitions,
  DirectiveDefinitionTuple,
  FieldDefinitionRecord,
  InputValueDefinitionRecord,
  TypeDefinitionTuple,
} from "../schema/definition";

// Type kind constants (matching the internal enum values in definition.ts)
const TYPE_KIND_SCALAR = 1;
const TYPE_KIND_OBJECT = 2;
const TYPE_KIND_INTERFACE = 3;
const TYPE_KIND_UNION = 4;
const TYPE_KIND_ENUM = 5;
const TYPE_KIND_INPUT = 6;

/**
 * Checks if `fragment` is a valid fragment of `schema`.
 *
 * A fragment is valid if any GraphQL operation that could be executed using
 * the fragment could also be executed with the full schema.
 *
 * Rules:
 * - Every type in fragment must exist in schema with the same kind
 * - Object/Interface types: every field in fragment must exist in schema with matching type;
 *   field arguments in fragment must be a subset of schema arguments (fragment may omit optional args)
 * - Union types: must match exactly (atomic)
 * - Enum types: must match exactly (atomic)
 * - Input object types: every field in fragment must exist in schema with matching type
 * - Scalar types: if fragment has it, schema must have it
 * - Directives: fragment's directive must exist in schema, fragment arguments must be a subset
 *   of schema arguments, and fragment's locations must be a subset of schema's locations
 *
 * @param schema - The full schema definitions
 * @param fragment - The schema fragment to validate
 * @returns true if fragment is a valid subset of schema
 */
export function isFragmentOf(
  schema: SchemaDefinitions,
  fragment: SchemaDefinitions,
): boolean {
  const schemaTypes = schema.types;
  const fragmentTypes = fragment.types;

  // Check all types in fragment exist in schema
  for (const typeName in fragmentTypes) {
    const schemaType = schemaTypes[typeName];
    if (!schemaType) return false;
    if (!isTypeFragmentOf(schemaType, fragmentTypes[typeName])) return false;
  }

  // Check all directives in fragment exist in schema
  const fragmentDirectives = fragment.directives;
  if (fragmentDirectives && fragmentDirectives.length > 0) {
    const schemaDirectives = schema.directives;
    if (!schemaDirectives) return false;

    // Build directive lookup map
    const directiveMap = new Map<string, DirectiveDefinitionTuple>();
    for (let i = 0; i < schemaDirectives.length; i++) {
      directiveMap.set(schemaDirectives[i][0], schemaDirectives[i]);
    }

    for (let i = 0; i < fragmentDirectives.length; i++) {
      const fragDir = fragmentDirectives[i];
      const schemaDir = directiveMap.get(fragDir[0]);
      if (!schemaDir) return false;
      if (!isDirectiveFragmentOf(schemaDir, fragDir)) return false;
    }
  }

  return true;
}

/**
 * Checks if fragmentType is a valid fragment of schemaType.
 */
function isTypeFragmentOf(
  schemaType: TypeDefinitionTuple,
  fragmentType: TypeDefinitionTuple,
): boolean {
  const kind = schemaType[0];

  // Types must have the same kind
  if (kind !== fragmentType[0]) return false;

  // Use direct kind comparison with switch for better performance
  switch (kind) {
    case TYPE_KIND_OBJECT:
    case TYPE_KIND_INTERFACE: {
      // Check fields are a subset
      if (
        !isFieldsFragmentOf(
          schemaType[1] as FieldDefinitionRecord,
          fragmentType[1] as FieldDefinitionRecord,
        )
      ) {
        return false;
      }
      // Check interfaces in fragment exist in schema
      const schemaIfaces = schemaType[2] as string[] | undefined;
      const fragIfaces = fragmentType[2] as string[] | undefined;
      if (fragIfaces && fragIfaces.length > 0) {
        if (!schemaIfaces) return false;
        return isArraySubset(schemaIfaces, fragIfaces);
      }
      return true;
    }

    case TYPE_KIND_INPUT:
      return isInputFieldsFragmentOf(
        schemaType[1] as InputValueDefinitionRecord,
        fragmentType[1] as InputValueDefinitionRecord,
      );

    case TYPE_KIND_UNION:
    case TYPE_KIND_ENUM:
      // Unions and enums are atomic - must match exactly
      return arraysEqual(
        schemaType[1] as string[],
        fragmentType[1] as string[],
      );

    case TYPE_KIND_SCALAR:
      // Scalars match if both exist (already checked kind)
      return true;

    default:
      return false;
  }
}

/**
 * Checks if fragmentFields is a valid fragment of schemaFields.
 * Every field in fragment must exist in schema with matching type.
 * Fragment arguments must be a subset of schema arguments.
 */
function isFieldsFragmentOf(
  schemaFields: FieldDefinitionRecord,
  fragmentFields: FieldDefinitionRecord,
): boolean {
  for (const fieldName in fragmentFields) {
    const schemaField = schemaFields[fieldName];
    if (schemaField === undefined) return false;

    const fragmentField = fragmentFields[fieldName];

    // Check field types match (direct array access for performance)
    const schemaType = Array.isArray(schemaField)
      ? schemaField[0]
      : schemaField;
    const fragmentType = Array.isArray(fragmentField)
      ? fragmentField[0]
      : fragmentField;

    if (schemaType !== fragmentType) return false;

    // Check fragment arguments are a subset of schema arguments
    const fragmentArgs = Array.isArray(fragmentField)
      ? fragmentField[1]
      : undefined;
    if (fragmentArgs) {
      const schemaArgs = Array.isArray(schemaField)
        ? schemaField[1]
        : undefined;
      if (!schemaArgs) return false;
      if (!isInputValuesSubset(schemaArgs, fragmentArgs)) return false;
    }
  }
  return true;
}

/**
 * Checks if fragmentFields is a valid fragment of schemaFields for input objects.
 * Every field in fragment must exist in schema with matching type.
 */
function isInputFieldsFragmentOf(
  schemaFields: InputValueDefinitionRecord,
  fragmentFields: InputValueDefinitionRecord,
): boolean {
  for (const fieldName in fragmentFields) {
    const schemaField = schemaFields[fieldName];
    if (schemaField === undefined) return false;

    const fragmentField = fragmentFields[fieldName];

    // Check field types match (direct array access for performance)
    const schemaType = Array.isArray(schemaField)
      ? schemaField[0]
      : schemaField;
    const fragmentType = Array.isArray(fragmentField)
      ? fragmentField[0]
      : fragmentField;

    if (schemaType !== fragmentType) return false;
  }
  return true;
}

/**
 * Checks if fragmentDirective is a valid fragment of schemaDirective.
 * Fragment arguments must be a subset of schema arguments, locations must be a subset.
 */
function isDirectiveFragmentOf(
  schemaDirective: DirectiveDefinitionTuple,
  fragmentDirective: DirectiveDefinitionTuple,
): boolean {
  // Check fragment arguments are a subset of schema arguments
  const fragmentArgs = fragmentDirective[2];
  if (fragmentArgs) {
    const schemaArgs = schemaDirective[2];
    if (!schemaArgs) return false;
    if (!isInputValuesSubset(schemaArgs, fragmentArgs)) return false;
  }

  // Check fragment locations are a subset of schema locations
  return isArraySubset(schemaDirective[1], fragmentDirective[1]);
}

/**
 * Checks if fragment arguments are a subset of schema arguments.
 * Every argument in fragment must exist in schema with matching type.
 */
function isInputValuesSubset(
  schemaArgs: InputValueDefinitionRecord,
  fragmentArgs: InputValueDefinitionRecord,
): boolean {
  for (const argName in fragmentArgs) {
    const schemaArg = schemaArgs[argName];
    if (schemaArg === undefined) return false;

    const fragmentArg = fragmentArgs[argName];

    // Check argument types match (direct array access for performance)
    const schemaType = Array.isArray(schemaArg) ? schemaArg[0] : schemaArg;
    const fragmentType = Array.isArray(fragmentArg)
      ? fragmentArg[0]
      : fragmentArg;

    if (schemaType !== fragmentType) return false;
  }
  return true;
}

/**
 * Checks if two arrays contain the same elements (order-independent).
 * Optimized for small arrays typical in GraphQL schemas.
 */
function arraysEqual<T>(a: T[], b: T[]): boolean {
  const len = a.length;
  if (len !== b.length) return false;
  if (len === 0) return true;
  if (len === 1) return a[0] === b[0];
  if (len === 2) {
    return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
  }

  // For larger arrays, use Set-based comparison (no sorting allocation)
  const setA = new Set(a);
  for (let i = 0; i < len; i++) {
    if (!setA.has(b[i])) return false;
  }
  return true;
}

/**
 * Checks if all elements in `subset` exist in `superset`.
 * Optimized for small arrays typical in GraphQL schemas.
 */
function isArraySubset<T>(superset: T[], subset: T[]): boolean {
  const len = subset.length;
  if (len === 0) return true;
  if (len === 1) return superset.includes(subset[0]);

  const supersetSet = new Set(superset);
  for (let i = 0; i < len; i++) {
    if (!supersetSet.has(subset[i])) return false;
  }
  return true;
}
