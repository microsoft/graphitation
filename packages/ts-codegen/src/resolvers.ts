import ts, { factory } from "typescript";
import {
  Field,
  ObjectType,
  UnionType,
  TsCodegenContext,
  ResolverType,
  InterfaceType,
  ContextTypeItem,
} from "./context";
import {
  getResolverReturnType,
  getSubscriptionResolver,
  createUnionResolveType,
  createInterfaceResolveType,
} from "./utilities";
import {
  createImportDeclaration,
  isRootOperationType,
} from "./context/utilities";

function getContextImportIdentifiers(
  imports: Record<string, string[]>,
  contextImportNames: Set<string>,
) {
  const statements = [];

  for (const [importPath, importNames] of Object.entries(imports)) {
    const importIndentifiers = importNames
      .map((importName: string) => {
        if (contextImportNames.has(importName)) {
          return;
        }
        contextImportNames.add(importName);
        return factory.createImportSpecifier(
          false,
          undefined,
          factory.createIdentifier(importName),
        );
      })
      .filter(Boolean) as ts.ImportSpecifier[];

    if (!importIndentifiers.length) {
      continue;
    }

    statements.push(
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          true,
          undefined,
          factory.createNamedImports(importIndentifiers),
        ),
        factory.createStringLiteral(importPath),
      ),
    );
  }

  return statements;
}

const getResolverTypes = (context: TsCodegenContext): ResolverType[] => {
  return context
    .getAllTypes()
    .filter(
      (type) =>
        type.kind === "OBJECT" ||
        type.kind === "UNION" ||
        type.kind === "INTERFACE",
    );
};

interface Options {
  generateResolverMap: boolean;
  mandatoryResolverTypes: boolean;
}

export function generateResolvers(
  context: TsCodegenContext,
  options: Options,
): ts.SourceFile {
  const { generateResolverMap, mandatoryResolverTypes } = options;
  const statements: ts.Statement[] = [];
  const resolverTypes = getResolverTypes(context);
  statements.push(
    ...resolverTypes.map((type) =>
      createResolversForType(context, type, mandatoryResolverTypes),
    ),
  );

  const extra: ts.Statement[] = [];
  if (generateResolverMap) {
    extra.push(createResolversMap(resolverTypes, mandatoryResolverTypes));
  }

  const source = factory.createSourceFile(
    [...generateImports(context), ...statements, ...extra],
    factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );
  source.fileName = "resolvers.interface.ts";
  return source;
}

function generateImports(context: TsCodegenContext) {
  const importStatements: ts.Statement[] = [
    ...(context.getAllImportDeclarations("RESOLVERS") as ts.Statement[]),
    ...context.getBasicImports(),
  ];
  if (context.hasModels) {
    importStatements.push(
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          false,
          undefined,
          factory.createNamespaceImport(factory.createIdentifier("Models")),
        ),
        factory.createStringLiteral("./models.interface"),
      ),
    );
  }

  const contextTypeExtensions = context.getContextTypeExtensions();
  if (Object.keys(context.getContextMap()).length && contextTypeExtensions) {
    if (context.baseSubTypeContext?.from && context.baseSubTypeContext?.name) {
      importStatements.push(
        createImportDeclaration(
          [context.baseSubTypeContext.name],
          context.baseSubTypeContext.from,
        ),
      );
    }

    const contextImportNames: Set<string> = new Set();
    for (const [, root] of Object.entries(context.getContextMap())) {
      const rootValue: ContextTypeItem[] | undefined = root.__context;
      if (rootValue) {
        if (rootValue.every(({ id }) => contextImportNames.has(id))) {
          continue;
        }

        const imports = context.getSubTypeNamesImportMap(rootValue);
        importStatements.push(
          ...getContextImportIdentifiers(imports, contextImportNames),
        );
      }
      for (const [key, value] of Object.entries(root)) {
        if (key.startsWith("__")) {
          continue;
        }
        if (value.every(({ id }) => contextImportNames.has(id))) {
          continue;
        }

        const imports = context.getSubTypeNamesImportMap(value);

        importStatements.push(
          ...getContextImportIdentifiers(imports, contextImportNames),
        );
      }
    }
  }

  return importStatements;
}

function createResolversForType(
  context: TsCodegenContext,
  type: ResolverType,
  mandatoryResolverTypes: boolean,
): ts.Statement {
  const { kind } = type;
  switch (kind) {
    case "OBJECT": {
      return createObjectTypeResolvers(context, type, mandatoryResolverTypes);
    }
    case "UNION": {
      return createUnionTypeResolvers(context, type);
    }
    case "INTERFACE": {
      return createInterfaceTypeResolvers(context, type);
    }
  }
  kind satisfies never;
}

function createObjectTypeResolvers(
  context: TsCodegenContext,
  type: ObjectType,
  mandatoryResolverTypes: boolean,
): ts.ModuleDeclaration {
  const members: ts.Statement[] = type.fields.map((field) =>
    createResolverField(context, type, field),
  );
  const resolversObject = factory.createInterfaceDeclaration(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier("Resolvers"),
    undefined,
    undefined,
    type.fields.map((field) =>
      factory.createPropertySignature(
        [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
        field.name,
        mandatoryResolverTypes && type.isExtension
          ? undefined
          : factory.createToken(ts.SyntaxKind.QuestionToken),
        type.name === "Subscription"
          ? factory.createTypeReferenceNode(toValidFieldName(field.name), [
              factory.createTypeReferenceNode("any", undefined),
            ])
          : factory.createTypeReferenceNode(toValidFieldName(field.name)),
      ),
    ),
  );
  members.unshift(resolversObject);
  return factory.createModuleDeclaration(
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
  type: ResolverType,
  field: Field,
): ts.TypeAliasDeclaration {
  let modelIdentifier;
  if (isRootOperationType(type.name)) {
    modelIdentifier = factory.createKeywordTypeNode(
      ts.SyntaxKind.UnknownKeyword,
    );
  } else {
    modelIdentifier = context
      .getModelType(type.name, "RESOLVERS")
      .toTypeReference();
  }

  const contextRootType =
    context.getContextMap()[type.name] ||
    (!isRootOperationType(type.name) &&
      context.getContextMap()[context.getTypeFromTypeNode(field.type)]);

  let contextTypes;
  if (contextRootType) {
    if (contextRootType[field.name]) {
      contextTypes = contextRootType[field.name];
    } else if (contextRootType.__context) {
      contextTypes = contextRootType.__context;
    }
  }

  context.setResolverTypeMapItem(type.name, field.name);

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
          type.kind !== "NonNullType"
            ? factory.createToken(ts.SyntaxKind.QuestionToken)
            : undefined,
          context.getTypeReferenceForInputTypeFromTypeNode(type, "RESOLVERS"),
        ),
      ),
    },
    context: {
      name: "context",
      type: context.getContextTypeNode(contextTypes),
    },
    resolveInfo: {
      name: "info",
      type: context.getResolveInfoType().toTypeReference(),
    },
  };

  if (type.name === "Subscription") {
    return getSubscriptionResolver(
      context.getTypeReferenceFromTypeNode(field.type, "RESOLVERS"),
      resolverParametersDefinitions,
      field.name,
    );
  }

  return factory.createTypeAliasDeclaration(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier(toValidFieldName(field.name)),
    type.name === "Subscription"
      ? [
          factory.createTypeParameterDeclaration(
            undefined,
            factory.createIdentifier("A"),
            undefined,
            factory.createLiteralTypeNode(factory.createNull()),
          ),
        ]
      : undefined,
    getResolverReturnType(
      context.getTypeReferenceForFieldResolverResultFromTypeNode(field.type),
      resolverParametersDefinitions,
    ),
  );
}

function createUnionTypeResolvers(
  context: TsCodegenContext,
  type: UnionType,
): ts.ModuleDeclaration {
  const resolversObject = factory.createInterfaceDeclaration(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier("Resolvers"),
    undefined,
    undefined,
    [
      factory.createPropertySignature(
        [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
        "__resolveType",
        factory.createToken(ts.SyntaxKind.QuestionToken),

        factory.createTypeReferenceNode("__resolveType"),
      ),
    ],
  );

  const contextRootType = context.getContextMap()[type.name];

  const contextTypes = context.getContextTypes(contextRootType);
  context.setResolverTypeMapItem(type.name, null);

  return factory.createModuleDeclaration(
    [
      factory.createModifier(ts.SyntaxKind.ExportKeyword),
      factory.createModifier(ts.SyntaxKind.DeclareKeyword),
    ],
    factory.createIdentifier(type.name),
    factory.createModuleBlock([
      resolversObject,
      factory.createTypeAliasDeclaration(
        [factory.createToken(ts.SyntaxKind.ExportKeyword)],
        factory.createIdentifier("__resolveType"),
        undefined,
        createUnionResolveType(
          context,
          type,
          context.getContextTypeNode(contextTypes),
        ),
      ),
    ]),
    ts.NodeFlags.Namespace,
  );
}

function createInterfaceTypeResolvers(
  context: TsCodegenContext,
  type: InterfaceType,
): ts.ModuleDeclaration {
  const contextRootType = context.getContextMap()[type.name];
  const contextTypes = context.getContextTypes(contextRootType);
  context.setResolverTypeMapItem(type.name, null);

  const resolversObject = factory.createInterfaceDeclaration(
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier("Resolvers"),
    undefined,
    undefined,
    [
      factory.createPropertySignature(
        [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
        "__resolveType",
        factory.createToken(ts.SyntaxKind.QuestionToken),

        factory.createTypeReferenceNode("__resolveType"),
      ),
    ],
  );
  return factory.createModuleDeclaration(
    [
      factory.createModifier(ts.SyntaxKind.ExportKeyword),
      factory.createModifier(ts.SyntaxKind.DeclareKeyword),
    ],
    factory.createIdentifier(type.name),
    factory.createModuleBlock([
      resolversObject,
      factory.createTypeAliasDeclaration(
        [factory.createToken(ts.SyntaxKind.ExportKeyword)],
        factory.createIdentifier("__resolveType"),
        undefined,
        createInterfaceResolveType(
          context,
          context.getContextTypeNode(contextTypes),
        ),
      ),
    ]),
    ts.NodeFlags.Namespace,
  );
}

function createResolversMap(
  types: ResolverType[],
  mandatoryResolverTypes: boolean,
): ts.InterfaceDeclaration {
  return factory.createInterfaceDeclaration(
    [
      factory.createModifier(ts.SyntaxKind.ExportKeyword),
      factory.createModifier(ts.SyntaxKind.DefaultKeyword),
    ],
    factory.createIdentifier("ResolversMap"),
    undefined,
    undefined,
    types.map((type) => {
      const isExtension = type.kind === "OBJECT" && type.isExtension;
      return factory.createPropertySignature(
        [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
        type.name,
        mandatoryResolverTypes && isExtension
          ? undefined
          : factory.createToken(ts.SyntaxKind.QuestionToken),
        factory.createTypeReferenceNode(
          factory.createQualifiedName(
            factory.createIdentifier(type.name),
            factory.createIdentifier("Resolvers"),
          ),
        ),
      );
    }),
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
  "unknown",
];
