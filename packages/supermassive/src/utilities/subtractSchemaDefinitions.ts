// Note: this utility is vibe-coded. Use at your own risk! :)
import {
  SchemaDefinitions,
  DirectiveDefinitionTuple,
  FieldDefinitionRecord,
  InputValueDefinitionRecord,
  TypeDefinitionsRecord,
  TypeDefinitionTuple,
  getDirectiveDefinitionArgs,
  getDirectiveName,
  getEnumValues,
  getFieldTypeReference,
  getFieldArgs,
  getFields,
  getInputObjectFields,
  getInputValueTypeReference,
  getUnionTypeMembers,
  isEnumTypeDefinition,
  isInputObjectTypeDefinition,
  isInterfaceTypeDefinition,
  isObjectTypeDefinition,
  isScalarTypeDefinition,
  isUnionTypeDefinition,
  createEnumTypeDefinition,
  createInputObjectTypeDefinition,
  createInterfaceTypeDefinition,
  createObjectTypeDefinition,
  createUnionTypeDefinition,
  getObjectTypeInterfaces,
  getInterfaceTypeInterfaces,
} from "../schema/definition";
import { inspect } from "../jsutils/inspect";

/**
 * Subtracts schema definitions from minuend that exist in subtrahend.
 * Returns a new SchemaDefinitions object without mutating inputs.
 *
 * @param minuend - The schema definitions to subtract from
 * @param subtrahend - The schema definitions to subtract
 * @param strict - If true, throws errors on items in subtrahend that are not in minuend; if false, ignores them
 * @returns A new SchemaDefinitions with elements from minuend not in subtrahend
 */
export function subtractSchemaDefinitions(
  minuend: SchemaDefinitions,
  subtrahend: SchemaDefinitions,
  strict = false,
): SchemaDefinitions {
  const result: SchemaDefinitions = {
    types: {},
    directives: [],
  };

  // Subtract types
  if (minuend.types && subtrahend.types) {
    result.types = subtractTypes(minuend.types, subtrahend.types, strict);
  } else if (minuend.types) {
    result.types = { ...minuend.types };
  }

  // Subtract directives
  if (minuend.directives && subtrahend.directives) {
    result.directives = subtractDirectives(
      minuend.directives,
      subtrahend.directives,
      strict,
    );
  } else if (minuend.directives) {
    result.directives = [...minuend.directives];
  }

  return result;
}

/**
 * Subtracts types from minuend that exist in subtrahend.
 */
function subtractTypes(
  minuend: TypeDefinitionsRecord,
  subtrahend: TypeDefinitionsRecord,
  strict: boolean,
): TypeDefinitionsRecord {
  const result: TypeDefinitionsRecord = {};

  for (const [typeName, minuendDef] of Object.entries(minuend)) {
    const subtrahendDef = subtrahend[typeName];

    if (!subtrahendDef) {
      // Type doesn't exist in subtrahend, keep it
      result[typeName] = minuendDef;
      continue;
    }

    // Validate type kinds match
    if (minuendDef[0] !== subtrahendDef[0]) {
      throw new Error(
        `Type ${typeName} is represented differently in different schema fragments:\n` +
          inspect(minuendDef) +
          `\n` +
          inspect(subtrahendDef),
      );
    }

    // Handle different type kinds
    const subtractedType = subtractType(
      typeName,
      minuendDef,
      subtrahendDef,
      strict,
    );
    if (subtractedType) {
      result[typeName] = subtractedType;
    }
  }

  // Check for types in subtrahend that don't exist in minuend
  for (const typeName of Object.keys(subtrahend)) {
    if (!(typeName in minuend)) {
      if (strict) {
        throw new Error(`Type ${typeName} does not exist in minuend`);
      }
      // In non-strict mode, ignore missing types
    }
  }

  return result;
}

/**
 * Subtracts a single type definition.
 */
function subtractType(
  typeName: string,
  minuendDef: TypeDefinitionTuple,
  subtrahendDef: TypeDefinitionTuple,
  strict: boolean,
): TypeDefinitionTuple | null {
  if (
    isObjectTypeDefinition(minuendDef) &&
    isObjectTypeDefinition(subtrahendDef)
  ) {
    const subtractedFields = subtractFields(
      typeName,
      getFields(minuendDef),
      getFields(subtrahendDef),
      strict,
    );
    if (Object.keys(subtractedFields).length === 0) {
      return null; // All fields removed
    }
    const interfaces = getObjectTypeInterfaces(minuendDef);
    return createObjectTypeDefinition(
      subtractedFields,
      interfaces.length > 0 ? interfaces : undefined,
    );
  }

  if (
    isInterfaceTypeDefinition(minuendDef) &&
    isInterfaceTypeDefinition(subtrahendDef)
  ) {
    const subtractedFields = subtractFields(
      typeName,
      getFields(minuendDef),
      getFields(subtrahendDef),
      strict,
    );
    if (Object.keys(subtractedFields).length === 0) {
      return null; // All fields removed
    }
    const interfaces = getInterfaceTypeInterfaces(minuendDef);
    return createInterfaceTypeDefinition(
      subtractedFields,
      interfaces.length > 0 ? interfaces : undefined,
    );
  }

  if (
    isInputObjectTypeDefinition(minuendDef) &&
    isInputObjectTypeDefinition(subtrahendDef)
  ) {
    const subtractedFields = subtractInputFields(
      typeName,
      getInputObjectFields(minuendDef),
      getInputObjectFields(subtrahendDef),
      strict,
    );
    if (Object.keys(subtractedFields).length === 0) {
      return null; // All fields removed
    }
    return createInputObjectTypeDefinition(subtractedFields);
  }

  if (
    isUnionTypeDefinition(minuendDef) &&
    isUnionTypeDefinition(subtrahendDef)
  ) {
    const subtractedMembers = subtractUnionMembers(
      typeName,
      getUnionTypeMembers(minuendDef),
      getUnionTypeMembers(subtrahendDef),
      strict,
    );
    if (subtractedMembers.length === 0) {
      return null; // All members removed
    }
    return createUnionTypeDefinition(subtractedMembers);
  }

  if (isEnumTypeDefinition(minuendDef) && isEnumTypeDefinition(subtrahendDef)) {
    const subtractedValues = subtractEnumValues(
      typeName,
      getEnumValues(minuendDef),
      getEnumValues(subtrahendDef),
      strict,
    );
    if (subtractedValues.length === 0) {
      return null; // All values removed
    }
    return createEnumTypeDefinition(subtractedValues);
  }

  if (
    isScalarTypeDefinition(minuendDef) &&
    isScalarTypeDefinition(subtrahendDef)
  ) {
    // Scalars are atomic - if subtrahend has it, remove entire scalar
    return null;
  }

  return null;
}

/**
 * Subtracts fields from object/interface types.
 */
function subtractFields(
  typeName: string,
  minuendFields: FieldDefinitionRecord,
  subtrahendFields: FieldDefinitionRecord,
  strict: boolean,
): FieldDefinitionRecord {
  const result: FieldDefinitionRecord = {};

  for (const [fieldName, minuendField] of Object.entries(minuendFields)) {
    const subtrahendField = subtrahendFields[fieldName];

    if (!subtrahendField) {
      // Field doesn't exist in subtrahend, keep it
      result[fieldName] = minuendField;
      continue;
    }

    // Validate field types match
    const minuendType = getFieldTypeReference(minuendField);
    const subtrahendType = getFieldTypeReference(subtrahendField);
    if (minuendType !== subtrahendType) {
      throw new Error(
        `Field ${typeName}.${fieldName} has different type: ${inspect(
          minuendType,
        )} vs ${inspect(subtrahendType)}`,
      );
    }

    // Validate field arguments match exactly
    const minuendArgs = getFieldArgs(minuendField);
    const subtrahendArgs = getFieldArgs(subtrahendField);

    // Both must have same argument structure
    if (!minuendArgs && !subtrahendArgs) {
      // Both have no arguments, field can be subtracted
    } else if (!minuendArgs || !subtrahendArgs) {
      // One has args, other doesn't - not exact match
      throw new Error(
        `Field arguments must match exactly for subtraction. Field ${typeName}.${fieldName} has different argument structures.`,
      );
    } else {
      // Both have arguments, compare them
      const minuendArgKeys = Object.keys(minuendArgs).sort();
      const subtrahendArgKeys = Object.keys(subtrahendArgs).sort();

      if (
        minuendArgKeys.length !== subtrahendArgKeys.length ||
        !minuendArgKeys.every((key, index) => key === subtrahendArgKeys[index])
      ) {
        throw new Error(
          `Field arguments must match exactly for subtraction. Field ${typeName}.${fieldName} has different argument keys.`,
        );
      }

      // Check each argument type matches
      for (const argName of minuendArgKeys) {
        const minuendArgType = getInputValueTypeReference(minuendArgs[argName]);
        const subtrahendArgType = getInputValueTypeReference(
          subtrahendArgs[argName],
        );
        if (minuendArgType !== subtrahendArgType) {
          throw new Error(
            `Field arguments must match exactly for subtraction. Field ${typeName}.${fieldName} argument ${argName} has different types.`,
          );
        }
      }
    }

    // Field exists in subtrahend and matches exactly, remove it
  }

  // Check for fields in subtrahend that don't exist in minuend
  for (const fieldName of Object.keys(subtrahendFields)) {
    if (!(fieldName in minuendFields)) {
      if (strict) {
        throw new Error(
          `Field ${typeName}.${fieldName} does not exist in minuend`,
        );
      }
      // In non-strict mode, ignore missing fields
    }
  }

  return result;
}

/**
 * Subtracts input fields from input object types.
 */
function subtractInputFields(
  typeName: string,
  minuendFields: InputValueDefinitionRecord,
  subtrahendFields: InputValueDefinitionRecord,
  strict: boolean,
): InputValueDefinitionRecord {
  const result: InputValueDefinitionRecord = {};

  for (const [fieldName, minuendField] of Object.entries(minuendFields)) {
    const subtrahendField = subtrahendFields[fieldName];

    if (!subtrahendField) {
      // Field doesn't exist in subtrahend, keep it
      result[fieldName] = minuendField;
      continue;
    }

    // Validate field types match
    const minuendType = getInputValueTypeReference(minuendField);
    const subtrahendType = getInputValueTypeReference(subtrahendField);
    if (minuendType !== subtrahendType) {
      throw new Error(
        `Input field ${typeName}.${fieldName} has different type: ${inspect(
          minuendType,
        )} vs ${inspect(subtrahendType)}`,
      );
    }

    // Field exists in subtrahend, remove it
  }

  // Check for fields in subtrahend that don't exist in minuend
  for (const fieldName of Object.keys(subtrahendFields)) {
    if (!(fieldName in minuendFields)) {
      if (strict) {
        throw new Error(
          `Input field ${typeName}.${fieldName} does not exist in minuend`,
        );
      }
      // In non-strict mode, ignore missing fields
    }
  }

  return result;
}

/**
 * Subtracts union members.
 */
function subtractUnionMembers(
  typeName: string,
  minuendMembers: string[],
  subtrahendMembers: string[],
  strict: boolean,
): string[] {
  // Union types must match exactly for subtraction
  const minuendSet = new Set(minuendMembers);
  const subtrahendSet = new Set(subtrahendMembers);

  // Check if they have the same members
  if (
    minuendMembers.length === subtrahendMembers.length &&
    minuendMembers.every((member) => subtrahendSet.has(member))
  ) {
    // Exact match - remove the entire union
    return [];
  }

  // Check for members in subtrahend that don't exist in minuend
  for (const member of subtrahendMembers) {
    if (!minuendSet.has(member)) {
      if (strict) {
        throw new Error(
          `Union ${typeName}: member ${member} does not exist in minuend`,
        );
      }
      // In non-strict mode, ignore missing members and keep the original union
      return minuendMembers;
    }
  }

  // If we get here, all subtrahend members exist in minuend but they don't match exactly
  throw new Error(
    `Union types must match exactly for subtraction. Union ${typeName} has different member sets.`,
  );
}

/**
 * Subtracts enum values.
 */
function subtractEnumValues(
  typeName: string,
  minuendValues: string[],
  subtrahendValues: string[],
  strict: boolean,
): string[] {
  // Enum types must match exactly for subtraction
  const minuendSet = new Set(minuendValues);
  const subtrahendSet = new Set(subtrahendValues);

  // Check if they have the same values
  if (
    minuendValues.length === subtrahendValues.length &&
    minuendValues.every((value) => subtrahendSet.has(value))
  ) {
    // Exact match - remove the entire enum
    return [];
  }

  // Check for values in subtrahend that don't exist in minuend
  for (const value of subtrahendValues) {
    if (!minuendSet.has(value)) {
      if (strict) {
        throw new Error(
          `Enum ${typeName}: value ${value} does not exist in minuend`,
        );
      }
      // In non-strict mode, ignore missing values and keep the original enum
      return minuendValues;
    }
  }

  // If we get here, all subtrahend values exist in minuend but they don't match exactly
  throw new Error(
    `Enum types must match exactly for subtraction. Enum ${typeName} has different value sets.`,
  );
}

/**
 * Subtracts directives.
 */
function subtractDirectives(
  minuendDirectives: DirectiveDefinitionTuple[],
  subtrahendDirectives: DirectiveDefinitionTuple[],
  strict: boolean,
): DirectiveDefinitionTuple[] {
  const result: DirectiveDefinitionTuple[] = [];

  for (const minuendDirective of minuendDirectives) {
    const minuendName = getDirectiveName(minuendDirective);
    const subtrahendDirective = subtrahendDirectives.find(
      (d) => getDirectiveName(d) === minuendName,
    );

    if (!subtrahendDirective) {
      // Directive doesn't exist in subtrahend, keep it
      result.push(minuendDirective);
      continue;
    }

    // Directive exists, check arguments
    const minuendArgs = getDirectiveDefinitionArgs(minuendDirective);
    const subtrahendArgs = getDirectiveDefinitionArgs(subtrahendDirective);

    if (!minuendArgs && !subtrahendArgs) {
      // Both have no arguments, remove entire directive
      continue;
    }

    if (!minuendArgs || !subtrahendArgs) {
      // One has args, other doesn't - arguments don't match exactly
      throw new Error(
        `Directive arguments must match exactly for subtraction. Directive ${minuendName} has different argument structures.`,
      );
    }

    // Both have arguments, check if they match exactly
    const minuendArgKeys = Object.keys(minuendArgs).sort();
    const subtrahendArgKeys = Object.keys(subtrahendArgs).sort();

    if (
      minuendArgKeys.length !== subtrahendArgKeys.length ||
      !minuendArgKeys.every((key, index) => key === subtrahendArgKeys[index])
    ) {
      throw new Error(
        `Directive arguments must match exactly for subtraction. Directive ${minuendName} has different argument keys.`,
      );
    }

    // Check each argument type matches
    for (const argName of minuendArgKeys) {
      const minuendArgType = getInputValueTypeReference(minuendArgs[argName]);
      const subtrahendArgType = getInputValueTypeReference(
        subtrahendArgs[argName],
      );
      if (minuendArgType !== subtrahendArgType) {
        throw new Error(
          `Directive arguments must match exactly for subtraction. Directive ${minuendName} argument ${argName} has different types.`,
        );
      }
    }

    // Arguments match exactly, remove entire directive
  }

  // Check for directives in subtrahend that don't exist in minuend
  for (const subtrahendDirective of subtrahendDirectives) {
    const subtrahendName = getDirectiveName(subtrahendDirective);
    const exists = minuendDirectives.some(
      (d) => getDirectiveName(d) === subtrahendName,
    );
    if (!exists) {
      if (strict) {
        throw new Error(
          `Directive ${subtrahendName} does not exist in minuend`,
        );
      }
      // In non-strict mode, ignore missing directives
    }
  }

  return result;
}
