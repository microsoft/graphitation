import { emit } from "./emit";
import { Kind, TypeNode } from "graphql";
import { BUILT_IN_SCALARS, Field, TsCodegenContext, Type } from "./context";
import { GeneratedFile } from "./types";
import {
  createListType,
  createNonNullableType,
  createNullableType,
} from "./utilities";

const ROOT_OPERATIONS = ["Query", "Mutation", "Subscription"];
const LEGACY_TYPES = [
  "OBJECT",
  "INPUT_OBJECT",
  "ENUM",
  "UNION",
  "INTERFACE",
  "SCALAR",
  "ENUM",
];

export function generateLegacyTypes(
  context: TsCodegenContext,
  generateTypeMap = false,
): GeneratedFile {
  const statements: string[] = [];
  const typesByName = new Map(
    context.getAllTypes().map((type) => [type.name, type]),
  );
  const schemaTypes = Array.from(typesByName.values());
  const allTypes = schemaTypes.filter(
    (type) =>
      LEGACY_TYPES.includes(type.kind) && !ROOT_OPERATIONS.includes(type.name),
  );

  statements.push(
    emit.createImportDeclaration(
      undefined,
      emit.createImportClause(
        false,
        undefined,
        emit.createNamespaceImport(emit.createIdentifier("Models")),
      ),
      emit.createStringLiteral("./models.interface"),
    ),
  );

  statements.push(
    emit.createExportDeclaration(
      undefined,
      false,
      undefined,
      emit.createStringLiteral("./models.interface"),
    ),
  );

  if (context.hasEnums) {
    statements.push(
      emit.createExportDeclaration(
        undefined,
        false,
        undefined,
        emit.createStringLiteral("./enums.interface"),
      ),
    );
  }

  statements.push(
    emit.createInterfaceDeclaration(
      [emit.createModifier("ExportKeyword")],
      "Scalars",
      undefined,
      undefined,
      Object.keys(BUILT_IN_SCALARS)
        .map((name: keyof typeof BUILT_IN_SCALARS) =>
          emit.createPropertySignature(
            [emit.createModifier("ReadonlyKeyword")],
            name,
            undefined,
            emit.createTypeReferenceNode(BUILT_IN_SCALARS[name]),
          ),
        )
        .concat(
          allTypes
            .filter(
              (type) =>
                type.kind === "SCALAR" &&
                !Object.prototype.hasOwnProperty.call(
                  BUILT_IN_SCALARS,
                  type.name,
                ),
            )
            .map((type) =>
              emit.createPropertySignature(
                [emit.createModifier("ReadonlyKeyword")],
                type.name,
                undefined,
                createModelReference(type.name),
              ),
            ),
        ),
    ),
  );

  if (generateTypeMap) {
    const scalarNames = new Set([
      ...Object.keys(BUILT_IN_SCALARS),
      ...schemaTypes
        .filter((type) => type.kind === "SCALAR")
        .map((type) => type.name),
    ]);
    const typeNames = new Set([
      ...scalarNames,
      ...schemaTypes.map((type) => type.name),
    ]);
    const fieldsByName = new Map<string, Map<string, Field>>();
    for (const type of context.getAllTypes()) {
      if (type.kind === "OBJECT" || type.kind === "INTERFACE") {
        const fields = fieldsByName.get(type.name) ?? new Map<string, Field>();
        for (const field of type.fields) {
          fields.set(field.name, field);
        }
        fieldsByName.set(type.name, fields);
      }
    }
    const getFields = (type: Type, seen = new Set<string>()): Field[] => {
      if (
        (type.kind !== "OBJECT" && type.kind !== "INTERFACE") ||
        seen.has(type.name)
      ) {
        return [];
      }
      seen.add(type.name);
      const fields = new Map<string, Field>();
      for (const name of type.interfaces) {
        const parent = typesByName.get(name);
        if (parent) {
          for (const field of getFields(parent, seen)) {
            fields.set(field.name, field);
          }
        }
      }
      for (const field of fieldsByName.get(type.name)?.values() ?? []) {
        fields.set(field.name, field);
      }
      return Array.from(fields.values());
    };
    let usesImportedTypes = false;
    const getPayloadReference = (name: string): string => {
      if (typeNames.has(name)) {
        return `TypeMap[${emit.createStringLiteral(name)}]`;
      }
      // Types absent from this document can only use their imported model shape.
      usesImportedTypes = true;
      return context.getModelType(name, "MODELS").toTypeReference();
    };
    const getFieldType = (node: TypeNode): string => {
      if (node.kind === Kind.NON_NULL_TYPE) {
        return createNonNullableType(getFieldType(node.type));
      }
      if (node.kind === Kind.LIST_TYPE) {
        return createListType(getFieldType(node.type));
      }
      return createNullableType(getPayloadReference(node.name.value));
    };
    const getPayloadType = (name: string): string => {
      if (scalarNames.has(name)) {
        return createScalarReference(name);
      }
      const type = typesByName.get(name);
      if (type?.kind === "UNION") {
        return emit.createUnionTypeNode(type.types.map(getPayloadReference));
      }
      if (type?.kind === "OBJECT" || type?.kind === "INTERFACE") {
        return emit.createTypeLiteralNode([
          emit.createPropertySignature(
            [emit.createModifier("ReadonlyKeyword")],
            "__typename",
            emit.createToken("QuestionToken"),
            type.kind === "OBJECT" ? emit.createStringLiteral(name) : "string",
          ),
          ...getFields(type).map((field) =>
            emit.createPropertySignature(
              [emit.createModifier("ReadonlyKeyword")],
              field.name,
              field.type.kind !== Kind.NON_NULL_TYPE
                ? emit.createToken("QuestionToken")
                : undefined,
              getFieldType(field.type),
            ),
          ),
        ]);
      }
      return createModelReference(name);
    };
    statements.push(
      emit.createTypeAliasDeclaration(
        [emit.createModifier("ExportKeyword")],
        "TypeMap",
        undefined,
        emit.createTypeLiteralNode(
          Array.from(typeNames)
            .filter((name) => !name.startsWith("__"))
            .sort()
            .map((name) =>
              emit.createPropertySignature(
                undefined,
                emit.createStringLiteral(name),
                undefined,
                getPayloadType(name),
              ),
            ),
        ),
      ),
    );

    if (usesImportedTypes) {
      statements.unshift(...context.getAllImportDeclarations("MODELS"));
    }
  }

  statements.push(
    emit.createInterfaceDeclaration(
      [emit.createModifier("ExportKeyword")],
      "Types",
      undefined,
      undefined,
      allTypes.map((type) =>
        emit.createPropertySignature(
          [emit.createModifier("ReadonlyKeyword")],
          type.name,
          undefined,
          Object.prototype.hasOwnProperty.call(BUILT_IN_SCALARS, type.name)
            ? createScalarReference(type.name)
            : createModelReference(type.name),
        ),
      ),
    ),
  );

  const source = emit.createSourceFile(
    statements,
    emit.createToken("EndOfFileToken"),
    undefined,
  );
  source.fileName = "legacy-types.interface.ts";
  return source;
}

function createScalarReference(name: string): string {
  return `Scalars[${emit.createStringLiteral(name)}]`;
}

function createModelReference(name: string): string {
  return emit.createTypeReferenceNode(
    emit.createQualifiedName(emit.createIdentifier("Models"), name),
  );
}
