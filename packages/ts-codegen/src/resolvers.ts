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
  UnionType,
  TsCodegenContext,
  Type,
} from "./context";
import {
  getResolverReturnType,
  createUnionTypeResolvers,
  createNonNullableTemplate,
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
  const extra: ts.Statement[] = [];
  if (context.isLegacyCompatMode()) {
    extra.push(...createNonNullableTemplate());
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
    case "UNION": {
      return factory.createModuleDeclaration(
        undefined,
        [
          factory.createModifier(ts.SyntaxKind.ExportKeyword),
          factory.createModifier(ts.SyntaxKind.DeclareKeyword),
        ],
        factory.createIdentifier(type.name),
        factory.createModuleBlock([
          factory.createTypeAliasDeclaration(
            undefined,
            [factory.createToken(ts.SyntaxKind.ExportKeyword)],
            factory.createIdentifier("__resolveType"),
            undefined,
            createUnionTypeResolvers(context, type),
          ),
        ]),
        ts.NodeFlags.Namespace,
      );
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
  const members: ts.Statement[] = type.fields.map((field) =>
    createResolverField(context, type, field),
  );
  const resolversObject = factory.createInterfaceDeclaration(
    undefined,
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier("Resolvers"),
    undefined,
    undefined,
    type.fields.map((field) =>
      factory.createPropertySignature(
        [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
        field.name,
        factory.createToken(ts.SyntaxKind.QuestionToken),
        factory.createTypeReferenceNode(toValidFieldName(field.name)),
      ),
    ),
  );
  members.unshift(resolversObject);
  return factory.createModuleDeclaration(
    undefined,
    [
      factory.createModifier(ts.SyntaxKind.ExportKeyword),
      factory.createModifier(ts.SyntaxKind.DeclareKeyword),
    ],
    factory.createIdentifier(type.name),
    factory.createModuleBlock(members),
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
    factory.createIdentifier(toValidFieldName(field.name)),
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

function toValidFieldName(fieldName: string): string {
  if (RESERVED_KEYWORDS.includes(fieldName)) {
    return `_${fieldName}`;
  } else {
    return fieldName;
  }
}

const RESERVED_KEYWORDS: string[] = [
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "null",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "as",
  "implements",
  "interface",
  "let",
  "package",
  "private",
  "protected",
  "public",
  "static",
  "yield",
  "any",
  "boolean",
  "constructor",
  "declare",
  "get",
  "module",
  "require",
  "number",
  "set",
  "string",
  "symbol",
  "type",
];
