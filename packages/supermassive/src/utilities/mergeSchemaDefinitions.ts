import {
  DirectiveDefinitionTuple,
  DirectiveTuple,
  FieldDefinitionRecord,
  getDirectiveDefinitionArgs,
  getDirectiveName,
  getFieldArgs,
  getFieldMetadata,
  getFields,
  getInputObjectFields,
  getTypeDefinitionMetadataIndex,
  getTypeDefinitionMetadata,
  InputValueDefinitionRecord,
  InterfaceTypeDefinitionTuple,
  isInputObjectTypeDefinition,
  isInterfaceTypeDefinition,
  isObjectTypeDefinition,
  ObjectTypeDefinitionTuple,
  SchemaDefinitions,
  setDirectiveDefinitionArgs,
  setFieldArgs,
  setFieldDirectives,
  TypeDefinitionsRecord,
  TypeDefinitionTuple,
  TypeDefinitionMetadata,
} from "../schema/definition";
import { inspect } from "../jsutils/inspect";

export function createSchemaDefinitions(definitions: SchemaDefinitions[]) {
  return mergeSchemaDefinitions({ types: {}, directives: [] }, definitions);
}

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

function mergeTypeMetadata(
  target: TypeDefinitionTuple,
  source: TypeDefinitionTuple,
): void {
  const targetMetadata: TypeDefinitionMetadata | undefined =
    getTypeDefinitionMetadata(target);
  const sourceMetadata: TypeDefinitionMetadata | undefined =
    getTypeDefinitionMetadata(source);

  const metadataIndex = getTypeDefinitionMetadataIndex(target);
  if (!sourceMetadata || !metadataIndex) {
    return;
  }

  if (!targetMetadata) {
    target[metadataIndex] ??= {};
    const targetMetadata: TypeDefinitionMetadata = target[
      metadataIndex
    ] as TypeDefinitionMetadata;
    if (sourceMetadata?.directives) {
      targetMetadata.directives = [...sourceMetadata.directives];
    }

    return;
  }

  if (sourceMetadata.directives && targetMetadata.directives) {
    for (const sourceDirective of sourceMetadata.directives) {
      const directiveName = sourceDirective[0];
      const exists = targetMetadata.directives.some(
        (d: DirectiveTuple) => d[0] === directiveName,
      );
      if (!exists) {
        targetMetadata.directives.push(sourceDirective);
      }
    }
  }
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

    mergeTypeMetadata(targetDef, sourceDef);

    if (
      (isObjectTypeDefinition(targetDef) &&
        isObjectTypeDefinition(sourceDef)) ||
      (isInterfaceTypeDefinition(targetDef) &&
        isInterfaceTypeDefinition(sourceDef))
    ) {
      mergeFields(getFields(targetDef), getFields(sourceDef));
      mergeInterfaces(targetDef, sourceDef);
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

    const sourceDirectives = getFieldMetadata(sourceDef);
    if (sourceDirectives) {
      const targetMetadata =
        getFieldMetadata(targetDef) ?? setFieldDirectives(targetDef, {});
      if (targetMetadata.directives && sourceDirectives.directives) {
        mergeFieldDirectives(
          targetMetadata.directives,
          sourceDirectives.directives,
        );
      }
    }
  }
}

function mergeFieldDirectives(
  target: DirectiveTuple[],
  source: DirectiveTuple[],
): void {
  for (const sourceDirective of source) {
    const directiveName = sourceDirective[0];
    const exists = target.some((d: DirectiveTuple) => d[0] === directiveName);
    if (!exists) {
      target.push(sourceDirective);
    }
  }
}

function mergeInterfaces(
  target: ObjectTypeDefinitionTuple | InterfaceTypeDefinitionTuple,
  source: ObjectTypeDefinitionTuple | InterfaceTypeDefinitionTuple,
): void {
  const targetInterfaces = target[2];
  const sourceInterfaces = source[2];

  if (!sourceInterfaces) {
    return;
  }

  if (!targetInterfaces) {
    target[2] = [...sourceInterfaces];
    return;
  }

  for (const interfaceName of sourceInterfaces) {
    if (!targetInterfaces.includes(interfaceName)) {
      targetInterfaces.push(interfaceName);
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
