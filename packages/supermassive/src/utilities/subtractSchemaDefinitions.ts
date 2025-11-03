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
 * @returns A new SchemaDefinitions with elements from minuend not in subtrahend
 */
export function subtractSchemaDefinitions(
  minuend: SchemaDefinitions,
  subtrahend: SchemaDefinitions,
): SchemaDefinitions {
  const result: SchemaDefinitions = {
    types: {},
    directives: [],
  };

  // Subtract types
  if (minuend.types && subtrahend.types) {
    result.types = subtractTypes(minuend.types, subtrahend.types);
  } else if (minuend.types) {
    result.types = { ...minuend.types };
  }

  // Subtract directives
  if (minuend.directives && subtrahend.directives) {
    result.directives = subtractDirectives(
      minuend.directives,
      subtrahend.directives,
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
    const subtractedType = subtractType(typeName, minuendDef, subtrahendDef);
    if (subtractedType) {
      result[typeName] = subtractedType;
    }
  }

  // Check for types in subtrahend that don't exist in minuend
  for (const typeName of Object.keys(subtrahend)) {
    if (!(typeName in minuend)) {
      throw new Error(`Type ${typeName} does not exist in minuend`);
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
): TypeDefinitionTuple | null {
  if (
    isObjectTypeDefinition(minuendDef) &&
    isObjectTypeDefinition(subtrahendDef)
  ) {
    const subtractedFields = subtractFields(
      typeName,
      getFields(minuendDef),
      getFields(subtrahendDef),
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

    // Field exists in subtrahend, remove it (ignore arguments)
  }

  // Check for fields in subtrahend that don't exist in minuend
  for (const fieldName of Object.keys(subtrahendFields)) {
    if (!(fieldName in minuendFields)) {
      throw new Error(
        `Field ${typeName}.${fieldName} does not exist in minuend`,
      );
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
      throw new Error(
        `Input field ${typeName}.${fieldName} does not exist in minuend`,
      );
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
): string[] {
  const result: string[] = [];
  const subtrahendSet = new Set(subtrahendMembers);

  for (const member of minuendMembers) {
    if (!subtrahendSet.has(member)) {
      result.push(member);
    }
  }

  // Check for members in subtrahend that don't exist in minuend
  const minuendSet = new Set(minuendMembers);
  for (const member of subtrahendMembers) {
    if (!minuendSet.has(member)) {
      throw new Error(
        `Union ${typeName}: member ${member} does not exist in minuend`,
      );
    }
  }

  return result;
}

/**
 * Subtracts enum values.
 */
function subtractEnumValues(
  typeName: string,
  minuendValues: string[],
  subtrahendValues: string[],
): string[] {
  const result: string[] = [];
  const subtrahendSet = new Set(subtrahendValues);

  for (const value of minuendValues) {
    if (!subtrahendSet.has(value)) {
      result.push(value);
    }
  }

  // Check for values in subtrahend that don't exist in minuend
  const minuendSet = new Set(minuendValues);
  for (const value of subtrahendValues) {
    if (!minuendSet.has(value)) {
      throw new Error(
        `Enum ${typeName}: value ${value} does not exist in minuend`,
      );
    }
  }

  return result;
}

/**
 * Subtracts directives.
 */
function subtractDirectives(
  minuendDirectives: DirectiveDefinitionTuple[],
  subtrahendDirectives: DirectiveDefinitionTuple[],
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
      // One has args, other doesn't - keep if minuend has more
      if (minuendArgs) {
        result.push(minuendDirective);
      }
      continue;
    }

    // Both have arguments, subtract them
    const subtractedArgs = subtractDirectiveArgs(
      minuendName,
      minuendArgs,
      subtrahendArgs,
    );

    if (Object.keys(subtractedArgs).length > 0) {
      // Has remaining arguments, keep directive with remaining args
      result.push([
        minuendName,
        minuendDirective[1],
        subtractedArgs,
      ] as DirectiveDefinitionTuple);
    }
    // If no arguments remain, directive is fully subtracted
  }

  // Check for directives in subtrahend that don't exist in minuend
  for (const subtrahendDirective of subtrahendDirectives) {
    const subtrahendName = getDirectiveName(subtrahendDirective);
    const exists = minuendDirectives.some(
      (d) => getDirectiveName(d) === subtrahendName,
    );
    if (!exists) {
      throw new Error(`Directive ${subtrahendName} does not exist in minuend`);
    }
  }

  return result;
}

/**
 * Subtracts directive arguments.
 */
function subtractDirectiveArgs(
  directiveName: string,
  minuendArgs: InputValueDefinitionRecord,
  subtrahendArgs: InputValueDefinitionRecord,
): InputValueDefinitionRecord {
  const result: InputValueDefinitionRecord = {};

  for (const [argName, minuendArg] of Object.entries(minuendArgs)) {
    const subtrahendArg = subtrahendArgs[argName];

    if (!subtrahendArg) {
      // Argument doesn't exist in subtrahend, keep it
      result[argName] = minuendArg;
      continue;
    }

    // Validate argument types match
    const minuendType = getInputValueTypeReference(minuendArg);
    const subtrahendType = getInputValueTypeReference(subtrahendArg);
    if (minuendType !== subtrahendType) {
      throw new Error(
        `Directive ${directiveName}: argument ${argName} has different type: ${inspect(
          minuendType,
        )} vs ${inspect(subtrahendType)}`,
      );
    }

    // Argument exists in subtrahend, remove it
  }

  // Check for arguments in subtrahend that don't exist in minuend
  for (const argName of Object.keys(subtrahendArgs)) {
    if (!(argName in minuendArgs)) {
      throw new Error(
        `Directive ${directiveName}: argument ${argName} does not exist in minuend`,
      );
    }
  }

  return result;
}
