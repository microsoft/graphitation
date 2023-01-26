import ts, { factory } from "typescript";
import {
  ASTNode,
  DocumentNode,
  isTypeDefinitionNode,
  isTypeExtensionNode,
  Kind,
} from "graphql";
import { ASTReducer, visit } from "./typedVisitor";
import {
  Field,
  InputObjectType,
  ObjectType,
  TsCodegenContext,
  Type,
} from "./context";
import {
  createNullableType,
  createNonNullableType,
  getResolverReturnType,
  getAncestorEntity,
} from "./utilities";

export function generateResolvers(
  context: TsCodegenContext,
  document: DocumentNode,
): ts.SourceFile {
  const statements = context
    .getAllTypes()
    .map((type) => createResolversForType(context, type))
    .filter((t) => t != null) as ts.Statement[];
  const imports = context.getAllResolverImportDeclarations() as ts.Statement[];
  const extra = [];
  if (context.isLegacyCompatMode()) {
    extra.push(createLegacyResolverNamespace(context, context.getAllTypes()));
  }
  return factory.createSourceFile(
    imports.concat(statements, extra),
    factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );
}

function createResolversForType(
  context: TsCodegenContext,
  type: Type,
): ts.Statement | null {
  switch (type.kind) {
    case "OBJECT": {
      return createObjectTypeResolvers(context, type);
    }
    case "INPUT_OBJECT": {
      return createInputObjectType(context, type);
    }
    default: {
      return null;
    }
  }
}

function createObjectTypeResolvers(
  context: TsCodegenContext,
  type: ObjectType,
): ts.ModuleDeclaration | null {
  const fields = type.fields.map((field) =>
    createResolverField(context, type, field),
  );
  return factory.createModuleDeclaration(
    undefined,
    [
      factory.createModifier(ts.SyntaxKind.ExportKeyword),
      factory.createModifier(ts.SyntaxKind.DeclareKeyword),
    ],
    factory.createIdentifier(type.name),
    factory.createModuleBlock(fields),
    ts.NodeFlags.Namespace,
  );
}

function createResolverField(
  context: TsCodegenContext,
  type: Type,
  field: Field,
): ts.TypeAliasDeclaration {
  let modelIdentifier;
  if (["Query", "Mutation", "Subscription"].includes(type.name)) {
    modelIdentifier = factory.createKeywordTypeNode(
      ts.SyntaxKind.UnknownKeyword,
    );
  } else {
    modelIdentifier = context
      .getModelType(type.name, "RESOLVERS")
      .toTypeReference();
  }

  const resolverParametersDefinitions = {
    parent: {
      name: "model",
      type: modelIdentifier as ts.TypeReferenceNode,
    },
    args: {
      name: "args",
      type: field.arguments.map(({ name, type }) =>
        factory.createPropertySignature(
          [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
          factory.createIdentifier(name),
          undefined,
          context.getTypeReferenceForInputTypeFromTypeNode(type, "RESOLVERS"),
        ),
      ),
    },
    context: {
      name: "context",
      type: context.getContextType().toTypeReference(),
    },
    resolveInfo: {
      name: "info",
      type: context.getResolveInfoType().toTypeReference(),
    },
  };

  return factory.createTypeAliasDeclaration(
    undefined,
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier(field.name),
    type.name === "Subscription"
      ? [
          factory.createTypeParameterDeclaration(
            factory.createIdentifier("A"),
            undefined,
            factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
          ),
        ]
      : undefined,
    getResolverReturnType(
      context.getTypeReferenceFromTypeNode(field.type, "RESOLVERS"),
      type.name,
      resolverParametersDefinitions,
    ),
  );
}

function createInputObjectType(
  context: TsCodegenContext,
  type: InputObjectType,
): ts.TypeAliasDeclaration {
  return factory.createTypeAliasDeclaration(
    undefined,
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    type.name,
    undefined,
    factory.createTypeLiteralNode(
      type.fields.map(({ name, type }) =>
        factory.createPropertySignature(
          [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
          factory.createIdentifier(name),
          undefined,
          context.getTypeReferenceForInputTypeFromTypeNode(type, "RESOLVERS"),
        ),
      ),
    ),
  );
}

function createLegacyResolverNamespace(
  context: TsCodegenContext,
  types: Type[],
): ts.ModuleDeclaration {
  const typeObjects: ts.Statement[] = [];
  types.forEach((type) => {
    if (type.kind === "OBJECT") {
      typeObjects.push(
        factory.createInterfaceDeclaration(
          undefined,
          [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          type.name,
          undefined,
          undefined,
          type.fields.map((field) =>
            factory.createPropertySignature(
              undefined,
              factory.createIdentifier(field.name),
              factory.createToken(ts.SyntaxKind.QuestionToken),
              factory.createTypeReferenceNode(
                factory.createQualifiedName(
                  factory.createIdentifier(type.name),
                  field.name,
                ),
              ),
            ),
          ),
        ),
      );
    }
  });
  return factory.createModuleDeclaration(
    undefined,
    [
      factory.createModifier(ts.SyntaxKind.ExportKeyword),
      factory.createModifier(ts.SyntaxKind.DeclareKeyword),
    ],
    factory.createIdentifier("_LegacyResolvers"),
    factory.createModuleBlock(typeObjects),
    ts.NodeFlags.Namespace,
  );
}
