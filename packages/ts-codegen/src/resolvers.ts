import { emit } from "./emit";
import {
  Field,
  ObjectType,
  UnionType,
  TsCodegenContext,
  ResolverType,
  InterfaceType,
  ContextTypeItem,
} from "./context";
import { GeneratedFile } from "./types";
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
): GeneratedFile {
  const { generateResolverMap, mandatoryResolverTypes } = options;
  const statements: string[] = [];
  const resolverTypes = getResolverTypes(context);
  statements.push(
    ...resolverTypes.map((type) =>
      createResolversForType(context, type, mandatoryResolverTypes),
    ),
  );

  const extra: string[] = [];
  if (generateResolverMap) {
    extra.push(createResolversMap(resolverTypes, mandatoryResolverTypes));
  }

  const source = emit.createSourceFile(
    [...generateImports(context), ...statements, ...extra],
    emit.createToken("EndOfFileToken"),
    undefined,
  );
  source.fileName = "resolvers.interface.ts";
  return source;
}

function convertImportKeyValuePairsToImportDeclarations(
  importKeyValuesPairs: Record<string, string[]>,
) {
  const importDeclarations: string[] = [];
  for (const [importPath, importNames] of Object.entries(
    importKeyValuesPairs,
  )) {
    importDeclarations.push(
      emit.createImportDeclaration(
        undefined,
        emit.createImportClause(
          true,
          undefined,
          emit.createNamedImports(
            importNames.map((importName) =>
              emit.createImportSpecifier(false, undefined, importName),
            ),
          ),
        ),
        emit.createStringLiteral(importPath),
      ),
    );
  }
  return importDeclarations;
}

function generateImports(context: TsCodegenContext) {
  const importStatements: string[] = [
    ...(context.getAllImportDeclarations("RESOLVERS") as string[]),
    ...context.getBasicImports(),
  ];
  if (context.hasModels) {
    importStatements.push(
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
): string {
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
): string {
  const members: string[] = type.fields.map((field) =>
    createResolverField(context, type, field),
  );
  const resolversObject = emit.createInterfaceDeclaration(
    [emit.createModifier("ExportKeyword")],
    "Resolvers",
    undefined,
    undefined,
    type.fields.map((field) =>
      emit.createPropertySignature(
        [emit.createModifier("ReadonlyKeyword")],
        field.name,
        mandatoryResolverTypes && type.isExtension
          ? undefined
          : emit.createToken("QuestionToken"),
        type.name === "Subscription"
          ? emit.createTypeReferenceNode(toValidFieldName(field.name), [
              emit.createTypeReferenceNode("any", undefined),
            ])
          : emit.createTypeReferenceNode(toValidFieldName(field.name)),
      ),
    ),
  );
  members.unshift(resolversObject);
  return emit.createModuleDeclaration(
    [
      emit.createModifier("ExportKeyword"),
      emit.createModifier("DeclareKeyword"),
    ],
    type.name,
    emit.createModuleBlock(members),
    undefined,
  );
}

function createResolverField(
  context: TsCodegenContext,
  type: ResolverType,
  field: Field,
): string {
  let modelIdentifier;
  if (isRootOperationType(type.name)) {
    modelIdentifier = emit.createKeywordTypeNode("UnknownKeyword");
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
      type: modelIdentifier,
    },
    args: {
      name: "args",
      type: field.arguments.map(({ name, type }) =>
        emit.createPropertySignature(
          [emit.createModifier("ReadonlyKeyword")],
          name,
          type.kind !== "NonNullType"
            ? emit.createToken("QuestionToken")
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

  return emit.createTypeAliasDeclaration(
    [emit.createModifier("ExportKeyword")],
    toValidFieldName(field.name),
    type.name === "Subscription"
      ? [
          emit.createTypeParameterDeclaration(
            undefined,
            "A",
            undefined,
            emit.createLiteralTypeNode(emit.createNull()),
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
): string {
  const resolversObject = emit.createInterfaceDeclaration(
    [emit.createModifier("ExportKeyword")],
    "Resolvers",
    undefined,
    undefined,
    [
      emit.createPropertySignature(
        [emit.createModifier("ReadonlyKeyword")],
        "__resolveType",
        emit.createToken("QuestionToken"),

        emit.createTypeReferenceNode("__resolveType"),
      ),
    ],
  );

  const contextRootType = context.getContextMap()[type.name];

  const contextTypes = context.getContextTypes(contextRootType);
  context.setResolverTypeMapItem(type.name, null);

  return emit.createModuleDeclaration(
    [
      emit.createModifier("ExportKeyword"),
      emit.createModifier("DeclareKeyword"),
    ],
    type.name,
    emit.createModuleBlock([
      resolversObject,
      emit.createTypeAliasDeclaration(
        [emit.createToken("ExportKeyword")],
        "__resolveType",
        undefined,
        createUnionResolveType(
          context,
          type,
          context.getContextTypeNode(contextTypes),
        ),
      ),
    ]),
    undefined,
  );
}

function createInterfaceTypeResolvers(
  context: TsCodegenContext,
  type: InterfaceType,
): string {
  const contextRootType = context.getContextMap()[type.name];
  const contextTypes = context.getContextTypes(contextRootType);
  context.setResolverTypeMapItem(type.name, null);

  const resolversObject = emit.createInterfaceDeclaration(
    [emit.createModifier("ExportKeyword")],
    "Resolvers",
    undefined,
    undefined,
    [
      emit.createPropertySignature(
        [emit.createModifier("ReadonlyKeyword")],
        "__resolveType",
        emit.createToken("QuestionToken"),

        emit.createTypeReferenceNode("__resolveType"),
      ),
    ],
  );
  return emit.createModuleDeclaration(
    [
      emit.createModifier("ExportKeyword"),
      emit.createModifier("DeclareKeyword"),
    ],
    type.name,
    emit.createModuleBlock([
      resolversObject,
      emit.createTypeAliasDeclaration(
        [emit.createToken("ExportKeyword")],
        "__resolveType",
        undefined,
        createInterfaceResolveType(
          context,
          context.getContextTypeNode(contextTypes),
        ),
      ),
    ]),
    undefined,
  );
}

function createResolversMap(
  types: ResolverType[],
  mandatoryResolverTypes: boolean,
): string {
  return emit.createInterfaceDeclaration(
    [
      emit.createModifier("ExportKeyword"),
      emit.createModifier("DefaultKeyword"),
    ],
    "ResolversMap",
    undefined,
    undefined,
    types.map((type) => {
      const isExtension = type.kind === "OBJECT" && type.isExtension;
      return emit.createPropertySignature(
        [emit.createModifier("ReadonlyKeyword")],
        type.name,
        mandatoryResolverTypes && isExtension
          ? undefined
          : emit.createToken("QuestionToken"),
        emit.createTypeReferenceNode(
          emit.createQualifiedName(
            emit.createIdentifier(type.name),
            "Resolvers",
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
