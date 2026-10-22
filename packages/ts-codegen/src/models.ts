import { emit } from "./emit";
import { isRootOperationType } from "./context/utilities";
import {
  ScalarType,
  TsCodegenContext,
  Type,
  InputObjectType,
  InterfaceType,
  ObjectType,
  UnionType,
  TypeLocation,
} from "./context";
import { GeneratedFile } from "./types";

export function generateModels(context: TsCodegenContext): GeneratedFile {
  let types = context.getAllTypes();
  if (context.isLegacyCompatMode()) {
    const mergedTypes = new Map<string, Type>();
    for (const type of types) {
      const previous = mergedTypes.get(type.name);
      mergedTypes.set(
        type.name,
        type.kind === "OBJECT" && previous?.kind === "OBJECT"
          ? {
              ...previous,
              isExtension: previous.isExtension && type.isExtension,
              fields: [...previous.fields, ...type.fields],
              interfaces: [
                ...new Set([...previous.interfaces, ...type.interfaces]),
              ],
            }
          : type,
      );
    }
    types = Array.from(mergedTypes.values());
  }
  const statements = types
    .map((type) => createModelForType(context, type))
    .filter((t) => t != null) as string[];

  const imports = context.getAllModelImportDeclarations() as string[];

  const enumsStatements: string[] = [];

  if (context.hasEnums) {
    if (context.hasUsedEnumsInModels) {
      enumsStatements.push(
        emit.createImportDeclaration(
          undefined,
          emit.createImportClause(
            false,
            undefined,
            emit.createNamespaceImport(emit.createIdentifier("Enums")),
          ),
          emit.createStringLiteral("./enums.interface"),
        ),
      );
    }

    enumsStatements.push(
      emit.createExportDeclaration(
        undefined,
        false,
        undefined,
        emit.createStringLiteral("./enums.interface"),
      ),
    );
  }

  const source = emit.createSourceFile(
    imports.concat(enumsStatements, context.getDefaultTypes(), statements),
    emit.createToken("EndOfFileToken"),
    undefined,
  );

  source.fileName = "models.interface.ts";
  return source;
}

function createModelForType(
  context: TsCodegenContext,
  type: Type,
): string | null {
  switch (type.kind) {
    case "OBJECT": {
      return createObjectTypeModel(context, type);
    }
    case "UNION": {
      return createUnionTypeModel(context, type);
    }
    case "INTERFACE": {
      return createInterfaceTypeModel(context, type);
    }
    case "SCALAR": {
      return createScalarModel(context, type);
    }
    case "INPUT_OBJECT": {
      return createInputObjectType(context, type);
    }
    default: {
      return null;
    }
  }
}

function createObjectTypeModel(
  context: TsCodegenContext,
  type: ObjectType,
): string | null {
  if (
    !context.isLegacyCompatMode() &&
    (isRootOperationType(type.name) || type.isExtension)
  ) {
    return null;
  }

  let model: TypeLocation | null = null;
  if (!context.shouldNotGenerateObjectModels()) {
    model = context.getDefinedModelType(type.name);
  }
  const interfaces = type.interfaces.map((name) => {
    return context.getModelType(name, "MODELS").toExpression();
  });
  const extendTypes = [context.getBaseModelType()];
  if (model) {
    extendTypes.push(model);
  }

  let fields: string[] = [];
  if (!model) {
    fields = type.fields.map(({ name, type: fieldType }) =>
      emit.createPropertySignature(
        [emit.createModifier("ReadonlyKeyword")],
        name,
        fieldType.kind !== "NonNullType"
          ? emit.createToken("QuestionToken")
          : undefined,
        context.getTypeReferenceFromTypeNode(fieldType, "MODELS"),
      ),
    );
  }

  return emit.createInterfaceDeclaration(
    [emit.createModifier("ExportKeyword")],
    type.name,
    undefined,
    [
      emit.createHeritageClause("ExtendsKeyword", [
        ...extendTypes.map((type) =>
          emit.createExpressionWithTypeArguments(
            type.toExpression(),
            undefined,
          ),
        ),
        ...interfaces.map((interfaceExpression) =>
          emit.createExpressionWithTypeArguments(
            interfaceExpression,
            undefined,
          ),
        ),
      ]),
    ],
    [
      emit.createPropertySignature(
        [emit.createModifier("ReadonlyKeyword")],
        "__typename",
        emit.createToken("QuestionToken"),
        emit.createLiteralTypeNode(emit.createStringLiteral(type.name)),
      ),
      ...fields,
    ],
  );
}

function createUnionTypeModel(
  context: TsCodegenContext,
  type: UnionType,
): string | null {
  return emit.createTypeAliasDeclaration(
    [emit.createModifier("ExportKeyword")],
    type.name,
    undefined,
    emit.createUnionTypeNode(
      type.types?.map((type) => {
        return context.getModelType(type, "MODELS").toTypeReference();
      }) || [],
    ),
  );
}

function createInterfaceTypeModel(
  context: TsCodegenContext,
  type: InterfaceType,
): string | null {
  const extendTypes = [context.getBaseModelType()];
  const interfaces = type.interfaces.map((name) => {
    return context.getModelType(name, "MODELS").toExpression();
  });
  const isLegacy = context.isLegacyInterface(type.name);

  if (isLegacy) {
    const fields = type.fields.map(({ name, type: fieldType }) =>
      emit.createPropertySignature(
        [emit.createModifier("ReadonlyKeyword")],
        name,
        fieldType.kind !== "NonNullType"
          ? emit.createToken("QuestionToken")
          : undefined,
        context.getTypeReferenceFromTypeNode(fieldType, "MODELS"),
      ),
    );

    return emit.createInterfaceDeclaration(
      [emit.createModifier("ExportKeyword")],
      type.name,
      undefined,
      [
        emit.createHeritageClause("ExtendsKeyword", [
          ...extendTypes.map((type) =>
            emit.createExpressionWithTypeArguments(
              type.toExpression(),
              undefined,
            ),
          ),
          ...interfaces.map((interfaceExpression) =>
            emit.createExpressionWithTypeArguments(
              interfaceExpression,
              undefined,
            ),
          ),
        ]),
      ],
      [
        emit.createPropertySignature(
          [emit.createModifier("ReadonlyKeyword")],
          "__typename",
          emit.createToken("QuestionToken"),
          emit.createKeywordTypeNode("StringKeyword"),
        ),
        ...fields,
      ],
    );
  } else {
    return emit.createInterfaceDeclaration(
      [emit.createModifier("ExportKeyword")],
      type.name,
      undefined,
      [
        emit.createHeritageClause("ExtendsKeyword", [
          ...extendTypes.map((type) =>
            emit.createExpressionWithTypeArguments(
              type.toExpression(),
              undefined,
            ),
          ),
          ...interfaces.map((interfaceExpression) =>
            emit.createExpressionWithTypeArguments(
              interfaceExpression,
              undefined,
            ),
          ),
        ]),
      ],
      [
        emit.createPropertySignature(
          [emit.createModifier("ReadonlyKeyword")],
          "__typename",
          emit.createToken("QuestionToken"),
          emit.createKeywordTypeNode("StringKeyword"),
        ),
      ],
    );
  }
}

function createScalarModel(
  context: TsCodegenContext,
  type: ScalarType,
): string | null {
  return context.getScalarDefinition(type.name) || null;
}

function createInputObjectType(
  context: TsCodegenContext,
  type: InputObjectType,
): string {
  return emit.createTypeAliasDeclaration(
    [emit.createModifier("ExportKeyword")],
    type.name,
    undefined,
    emit.createTypeLiteralNode(
      type.fields.map(({ name, type }) =>
        emit.createPropertySignature(
          [emit.createModifier("ReadonlyKeyword")],
          name,
          type.kind !== "NonNullType"
            ? emit.createToken("QuestionToken")
            : undefined,
          context.getTypeReferenceForInputTypeFromTypeNode(type, "MODELS"),
        ),
      ),
    ),
  );
}
