import ts, { factory, ImportDeclaration } from "typescript";
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
import { isRootOperationType } from "./context/utilities";

function getDeduplicatedContextImportNames(
  imports: Record<string, string[]>,
  contextImportNames: Set<string>,
) {
  const importKeyValuesPairs: Record<string, string[]> = {};

  for (const [importPath, importNames] of Object.entries(imports)) {
    const importIdentifiers = importNames
      .map((importName: string) => {
        if (contextImportNames.has(importName)) {
          return;
        }
        contextImportNames.add(importName);
        return importName;
      })
      .filter(Boolean) as string[];

    if (!importIdentifiers.length) {
      continue;
    }

    importKeyValuesPairs[importPath] ??= importIdentifiers;
  }

  return importKeyValuesPairs;
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

function convertImportKeyValuePairsToImportDeclarations(
  importKeyValuesPairs: Record<string, string[]>,
) {
  const importDeclarations: ImportDeclaration[] = [];
  for (const [importPath, importNames] of Object.entries(
    importKeyValuesPairs,
  )) {
    importDeclarations.push(
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          true,
          undefined,
          factory.createNamedImports(
            importNames.map((importName) =>
              factory.createImportSpecifier(
                false,
                undefined,
                factory.createIdentifier(importName),
              ),
            ),
          ),
        ),
        factory.createStringLiteral(importPath),
      ),
    );
  }
  return importDeclarations;
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

  const groupedContextImportKeyValuesPairs: Record<string, string[]> = {};

  const contextTypeExtensions = context.getContextTypeExtensions();
  if (Object.keys(context.getContextMap()).length && contextTypeExtensions) {
    const uniqueContextImportNames: Set<string> = new Set();
    let baseContextUsed = false;
    let legacyBaseContextUsed = false;

    const addContextTypeItemToGroupedContextImportKeyValuesPairs = (
      contextTypeItem: ContextTypeItem,
    ) => {
      if (contextTypeItem.isLegacy) {
        legacyBaseContextUsed = true;
      } else {
        baseContextUsed = true;
      }

      const importKeyValuePairs =
        context.convertContextTypeItemToImportKeyValuePairs(contextTypeItem);

      for (const [importPath, importNames] of Object.entries(
        getDeduplicatedContextImportNames(
          importKeyValuePairs,
          uniqueContextImportNames,
        ),
      )) {
        if (!groupedContextImportKeyValuesPairs[importPath]) {
          groupedContextImportKeyValuesPairs[importPath] = importNames;
          continue;
        }

        groupedContextImportKeyValuesPairs[importPath].push(...importNames);
      }
    };

    const markBaseContextUsed = (contextTypeItem: ContextTypeItem) => {
      if (contextTypeItem.isLegacy) {
        legacyBaseContextUsed = true;
      } else {
        baseContextUsed = true;
      }
    };

    for (const [, root] of Object.entries(context.getContextMap())) {
      const rootValue: ContextTypeItem | undefined = root.__context;
      if (rootValue) {
        if (
          rootValue.values.every(({ id }) => uniqueContextImportNames.has(id))
        ) {
          // When values is empty, we still need to mark base context as used
          if (rootValue.values.length === 0) {
            markBaseContextUsed(rootValue);
          }
          continue;
        }

        addContextTypeItemToGroupedContextImportKeyValuesPairs(rootValue);
      }
      for (const [key, contextTypeItem] of Object.entries(root)) {
        if (key.startsWith("__")) {
          continue;
        }
        if (
          contextTypeItem.values.every(({ id }) =>
            uniqueContextImportNames.has(id),
          )
        ) {
          // When values is empty, we still need to mark base context as used
          if (contextTypeItem.values.length === 0) {
            markBaseContextUsed(contextTypeItem);
          }
          continue;
        }

        addContextTypeItemToGroupedContextImportKeyValuesPairs(contextTypeItem);
      }
    }

    const setBaseContextToKeyValuePairs = (baseContext: {
      name: string;
      from: string;
    }) => {
      if (!groupedContextImportKeyValuesPairs[baseContext.from]) {
        groupedContextImportKeyValuesPairs[baseContext.from] = [
          baseContext.name,
        ];
      } else {
        groupedContextImportKeyValuesPairs[baseContext.from].push(
          baseContext.name,
        );
      }
    };

    if (baseContextUsed && context.baseContext) {
      if (context.baseContext) {
        setBaseContextToKeyValuePairs(context.baseContext);
      }
    }

    if (legacyBaseContextUsed && context.legacyBaseContext) {
      if (context.legacyBaseContext) {
        setBaseContextToKeyValuePairs(context.legacyBaseContext);
      }
    }
    importStatements.push(
      ...convertImportKeyValuePairsToImportDeclarations(
        groupedContextImportKeyValuesPairs,
      ),
    );
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
