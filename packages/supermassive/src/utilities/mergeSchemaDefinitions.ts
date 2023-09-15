import {
  DirectiveDefinitionTuple,
  FieldDefinitionRecord,
  getDirectiveDefinitionArgs,
  getDirectiveName,
  getFieldArgs,
  getFields,
  getInputObjectFields,
  InputValueDefinitionRecord,
  isInputObjectTypeDefinition,
  isInterfaceTypeDefinition,
  isObjectTypeDefinition,
  SchemaDefinitions,
  setDirectiveDefinitionArgs,
  setFieldArgs,
  TypeDefinitionsRecord,
} from "../schema/definition";
import { inspect } from "../jsutils/inspect";

export function mergeSchemaDefinitions(
  accumulator: SchemaDefinitions,
  definitions: SchemaDefinitions[],
): SchemaDefinitions {
  if (!definitions.length) {
    return accumulator;
  }
  for (const source of definitions) {
    if (!accumulator.types) {
      accumulator.types = source.types;
    } else if (source.types) {
      mergeTypes(accumulator.types, source.types);
    }
    if (!accumulator.directives) {
      accumulator.directives = source.directives;
    } else if (source.directives?.length) {
      mergeDirectives(accumulator.directives, source.directives);
    }
  }
  return accumulator;
}

export function mergeDirectives(
  target: DirectiveDefinitionTuple[],
  source: DirectiveDefinitionTuple[],
) {
  for (const sourceDirective of source) {
    const targetDirective = target.find(
      (directive) =>
        getDirectiveName(directive) === getDirectiveName(sourceDirective),
    );
    if (!targetDirective) {
      target.push(sourceDirective);
      continue;
    }
    const sourceArgs = getDirectiveDefinitionArgs(sourceDirective);
    if (!sourceArgs) {
      continue;
    }
    const targetArgs = getDirectiveDefinitionArgs(targetDirective);
    if (!targetArgs) {
      setDirectiveDefinitionArgs(targetDirective, sourceArgs);
      continue;
    }
    mergeInputValues(targetArgs, sourceArgs);
  }
}

/**
 * Adds missing definitions from source into target. Mutates target in place.
 */
export function mergeTypes(
  target: TypeDefinitionsRecord,
  source: TypeDefinitionsRecord,
): void {
  for (const [typeName, sourceDef] of Object.entries(source)) {
    const targetDef = target[typeName];
    if (!targetDef) {
      target[typeName] = sourceDef;
      continue;
    }
    if (
      (isObjectTypeDefinition(targetDef) &&
        isObjectTypeDefinition(sourceDef)) ||
      (isInterfaceTypeDefinition(targetDef) &&
        isInterfaceTypeDefinition(sourceDef))
    ) {
      mergeFields(getFields(targetDef), getFields(sourceDef));
      // Note: not merging implemented interfaces - assuming they are fully defined by the first occurrence
      continue;
    }
    if (
      isInputObjectTypeDefinition(targetDef) &&
      isInputObjectTypeDefinition(sourceDef)
    ) {
      mergeInputValues(
        getInputObjectFields(targetDef),
        getInputObjectFields(sourceDef),
      );
      continue;
    }
    // Note: not merging scalars, unions and enums - assuming they are fully defined by the first occurrence
    if (targetDef[0] !== sourceDef[0]) {
      throw new Error(
        `Type ${typeName} is represented differently in different schema fragments:\n` +
          inspect(targetDef) +
          `\n` +
          inspect(sourceDef),
      );
    }
  }
}

function mergeFields(
  target: FieldDefinitionRecord,
  source: FieldDefinitionRecord,
) {
  for (const [fieldName, sourceDef] of Object.entries(source)) {
    const targetDef = target[fieldName];
    if (!target[fieldName] || !Array.isArray(targetDef)) {
      target[fieldName] = sourceDef;
      continue;
    }
    const sourceArgs = getFieldArgs(sourceDef);
    if (sourceArgs) {
      const targetArgs = getFieldArgs(targetDef) ?? setFieldArgs(targetDef, {});
      mergeInputValues(targetArgs, sourceArgs);
    }
  }
}

function mergeInputValues(
  target: InputValueDefinitionRecord,
  source: InputValueDefinitionRecord,
) {
  for (const [fieldName, sourceDef] of Object.entries(source)) {
    const targetDef = target[fieldName];
    if (!target[fieldName] || !Array.isArray(targetDef)) {
      target[fieldName] = sourceDef;
    }
    // Note: not merging defaultValue - assuming it is fully defined by the first occurrence
  }
}
