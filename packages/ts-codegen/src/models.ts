import ts, { factory } from "typescript";
import {
  ScalarType,
  TsCodegenContext,
  Type,
  InterfaceType,
  ObjectType,
  UnionType,
  TypeLocation,
} from "./context";

export function generateModels(context: TsCodegenContext): ts.SourceFile {
  const statements = context
    .getAllTypes()
    .map((type) => createModelForType(context, type))
    .filter((t) => t != null) as ts.Statement[];

  const imports = context.getAllModelImportDeclarations() as ts.Statement[];

  const enumsStatements: ts.Statement[] = [];

  if (context.hasEnums) {
    if (context.hasUsedEnumsInModels) {
      enumsStatements.push(
        factory.createImportDeclaration(
          undefined,
          factory.createImportClause(
            false,
            undefined,
            factory.createNamespaceImport(factory.createIdentifier("Enums")),
          ),
          factory.createStringLiteral("./enums.interface"),
        ),
      );
    }

    enumsStatements.push(
      factory.createExportDeclaration(
        undefined,
        false,
        undefined,
        factory.createStringLiteral("./enums.interface"),
      ),
    );
  }

  const source = factory.createSourceFile(
    imports.concat(enumsStatements, context.getDefaultTypes(), statements),
    factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );

  source.fileName = "models.interface.ts";
  return source;
}

function createModelForType(
  context: TsCodegenContext,
  type: Type,
): ts.Statement | null {
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
    default: {
      return null;
    }
  }
}

function createObjectTypeModel(
  context: TsCodegenContext,
  type: ObjectType,
): ts.InterfaceDeclaration | null {
  if (
    ["Query", "Mutation", "Subscription"].includes(type.name) ||
    type.isExtension
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

  let fields: ts.PropertySignature[] = [];
  if (!model) {
    fields = type.fields.map(({ name, type: fieldType }) =>
      factory.createPropertySignature(
        [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
        factory.createIdentifier(name),
        fieldType.kind !== "NonNullType"
          ? factory.createToken(ts.SyntaxKind.QuestionToken)
          : undefined,
        context.getTypeReferenceFromTypeNode(fieldType, "MODELS"),
      ),
    );
  }

  return factory.createInterfaceDeclaration(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier(type.name),
    undefined,
    [
      factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
        ...extendTypes.map((type) =>
          factory.createExpressionWithTypeArguments(
            type.toExpression(),
            undefined,
          ),
        ),
        ...interfaces.map((interfaceExpression) =>
          factory.createExpressionWithTypeArguments(
            interfaceExpression,
            undefined,
          ),
        ),
      ]),
    ],
    [
      factory.createPropertySignature(
        [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
        "__typename",
        factory.createToken(ts.SyntaxKind.QuestionToken),
        factory.createLiteralTypeNode(factory.createStringLiteral(type.name)),
      ),
      ...fields,
    ],
  );
}

function createUnionTypeModel(
  context: TsCodegenContext,
  type: UnionType,
): ts.TypeAliasDeclaration | null {
  return factory.createTypeAliasDeclaration(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier(type.name),
    undefined,
    factory.createUnionTypeNode(
      type.types?.map((type) => {
        return context.getModelType(type, "MODELS").toTypeReference();
      }) || [],
    ),
  );
}

function createInterfaceTypeModel(
  context: TsCodegenContext,
  type: InterfaceType,
): ts.InterfaceDeclaration | null {
  const extendTypes = [context.getBaseModelType()];
  const interfaces = type.interfaces.map((name) => {
    return context.getModelType(name, "MODELS").toExpression();
  });
  const isLegacy = context.isLegacyInterface(type.name);

  if (isLegacy) {
    const fields = type.fields.map(({ name, type: fieldType }) =>
      factory.createPropertySignature(
        [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
        factory.createIdentifier(name),
        fieldType.kind !== "NonNullType"
          ? factory.createToken(ts.SyntaxKind.QuestionToken)
          : undefined,
        context.getTypeReferenceFromTypeNode(fieldType, "MODELS"),
      ),
    );

    return factory.createInterfaceDeclaration(
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier(type.name),
      undefined,
      [
        factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
          ...extendTypes.map((type) =>
            factory.createExpressionWithTypeArguments(
              type.toExpression(),
              undefined,
            ),
          ),
          ...interfaces.map((interfaceExpression) =>
            factory.createExpressionWithTypeArguments(
              interfaceExpression,
              undefined,
            ),
          ),
        ]),
      ],
      [
        factory.createPropertySignature(
          [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
          "__typename",
          factory.createToken(ts.SyntaxKind.QuestionToken),
          factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
        ),
        ...fields,
      ],
    );
  } else {
    return factory.createInterfaceDeclaration(
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier(type.name),
      undefined,
      [
        factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
          ...extendTypes.map((type) =>
            factory.createExpressionWithTypeArguments(
              type.toExpression(),
              undefined,
            ),
          ),
          ...interfaces.map((interfaceExpression) =>
            factory.createExpressionWithTypeArguments(
              interfaceExpression,
              undefined,
            ),
          ),
        ]),
      ],
      [
        factory.createPropertySignature(
          [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
          "__typename",
          factory.createToken(ts.SyntaxKind.QuestionToken),
          factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
        ),
      ],
    );
  }
}

function createScalarModel(
  context: TsCodegenContext,
  type: ScalarType,
): ts.TypeAliasDeclaration | null {
  return context.getScalarDefinition(type.name) || null;
}
