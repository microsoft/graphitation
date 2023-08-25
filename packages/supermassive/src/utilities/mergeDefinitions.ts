import {
  FieldDefinitionRecord,
  FieldKeys,
  InputObjectKeys,
  InputValueDefinitionRecord,
  InterfaceKeys,
  ObjectKeys,
  TypeDefinitionRecord,
  TypeKind,
} from "../types/definition";
import { inspect } from "../jsutils/inspect";

/**
 * Adds missing definitions from source into target. Mutates target in place.
 */
export function mergeTypes(
  target: TypeDefinitionRecord,
  source: TypeDefinitionRecord,
): void {
  for (const [typeName, sourceDef] of Object.entries(source)) {
    const targetDef = target[typeName];
    if (!targetDef) {
      target[typeName] = sourceDef;
      continue;
    }
    if (targetDef[0] === TypeKind.OBJECT && sourceDef[0] === TypeKind.OBJECT) {
      mergeFields(targetDef[ObjectKeys.fields], sourceDef[ObjectKeys.fields]);
      // Note: not merging implemented interfaces - assuming they are fully defined by the first occurrence
      continue;
    }
    if (
      targetDef[0] === TypeKind.INTERFACE &&
      sourceDef[0] === TypeKind.INTERFACE
    ) {
      mergeFields(
        targetDef[InterfaceKeys.fields],
        sourceDef[InterfaceKeys.fields],
      );
      // Note: not merging implemented interfaces - assuming they are fully defined by the first occurrence
      continue;
    }
    if (targetDef[0] === TypeKind.INPUT && sourceDef[0] === TypeKind.INPUT) {
      mergeInputValues(
        targetDef[InputObjectKeys.fields],
        sourceDef[InputObjectKeys.fields],
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
    if (Array.isArray(sourceDef) && sourceDef[FieldKeys.arguments]) {
      if (!targetDef[FieldKeys.arguments]) {
        targetDef[FieldKeys.arguments] = {};
      }
      mergeInputValues(
        targetDef[FieldKeys.arguments],
        sourceDef[FieldKeys.arguments],
      );
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
