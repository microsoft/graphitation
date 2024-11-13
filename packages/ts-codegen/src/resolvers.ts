import ts, { factory } from "typescript";
import {
  Field,
  ObjectType,
  UnionType,
  TsCodegenContext,
  Type,
  InterfaceType,
} from "./context";
import {
  getResolverReturnType,
  getSubscriptionResolver,
  createUnionResolveType,
  createInterfaceResolveType,
} from "./utilities";

export function generateResolvers(context: TsCodegenContext): ts.SourceFile {
  const statements: ts.Statement[] = [];
  statements.push(...context.getBasicImports());
  statements.push(
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

  const contextTemplate = context.getContextTemplate();

  if (Object.keys(context.getContextMap()).length && contextTemplate) {
    const contextImportNames: Set<string> = new Set();
    for (const [, root] of Object.entries(context.getContextMap())) {
      const rootValue: string[] = (root as any).__context;
      if (rootValue) {
        if (
          rootValue.every((importName: string) =>
            contextImportNames.has(importName),
          )
        ) {
          continue;
        }
        const imports = (rootValue as string[]).reduce<
          Record<string, string[]>
        >((acc: Record<string, string[]>, importName: string) => {
          const importPath = context.replaceTemplateWithContextName(
            contextTemplate.pathTemplate,
            importName,
            false,
          );
          if (importPath) {
            if (!acc[importPath]) {
              acc[importPath] = [];
            }
            acc[importPath].push(
              context.replaceTemplateWithContextName(
                contextTemplate.nameTemplate,
                importName,
              ),
            );
          }
          return acc;
        }, {});
        for (const [importPath, importNames] of Object.entries(imports)) {
          statements.push(
            factory.createImportDeclaration(
              undefined,
              factory.createImportClause(
                true,
                undefined,
                factory.createNamedImports(
                  importNames
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
                    .filter(Boolean) as ts.ImportSpecifier[],
                ),
              ),
              factory.createStringLiteral(importPath),
            ),
          );
        }
      }
      for (const [key, value] of Object.entries(root as any)) {
        if (key.startsWith("__")) {
          continue;
        }
        if (
          (value as string[]).every((importName: string) =>
            contextImportNames.has(importName),
          )
        ) {
          continue;
        }
        const imports = (value as string[]).reduce<Record<string, string[]>>(
          (acc: Record<string, string[]>, importName: string) => {
            const importPath = context.replaceTemplateWithContextName(
              contextTemplate.pathTemplate,
              importName,
              false,
            );
            if (importPath) {
              if (!acc[importPath]) {
                acc[importPath] = [];
              }
              acc[importPath].push(
                context.replaceTemplateWithContextName(
                  contextTemplate.nameTemplate,
                  importName,
                ),
              );
            }
            return acc;
          },
          {},
        );

        for (const [importPath, importNames] of Object.entries(imports)) {
          statements.push(
            factory.createImportDeclaration(
              undefined,
              factory.createImportClause(
                true,
                undefined,
                factory.createNamedImports(
                  importNames
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
                    .filter(Boolean) as ts.ImportSpecifier[],
                ),
              ),
              factory.createStringLiteral(importPath),
            ),
          );
        }
      }
    }
  }

  if (context.hasInputs) {
    statements.push(
      factory.createImportDeclaration(
        undefined,
        factory.createImportClause(
          false,
          undefined,
          factory.createNamespaceImport(factory.createIdentifier("Inputs")),
        ),
        factory.createStringLiteral("./inputs.interface"),
      ),
    );

    statements.push(
      factory.createExportDeclaration(
        undefined,
        false,
        undefined,
        factory.createStringLiteral("./inputs.interface"),
      ),
    );
  }

  statements.push(
    ...(context
      .getAllTypes()
      .map((type) => createResolversForType(context, type))
      .filter((t) => t != null) as ts.Statement[]),
  );

  const extra: ts.Statement[] = [];
  const source = factory.createSourceFile(
    (context.getAllImportDeclarations("RESOLVERS") as ts.Statement[])
      .concat(statements)
      .concat(extra),
    factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );
  source.fileName = "resolvers.interface.ts";
  return source;
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
      return createUnionTypeResolvers(context, type);
    }
    case "INTERFACE": {
      return createInterfaceTypeResolvers(context, type);
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
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier("Resolvers"),
    undefined,
    undefined,
    type.fields.map((field) =>
      factory.createPropertySignature(
        [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
        field.name,
        factory.createToken(ts.SyntaxKind.QuestionToken),
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

function isRootOperationType(type: string): boolean {
  return ["Query", "Mutation", "Subscription"].includes(type);
}
function createResolverField(
  context: TsCodegenContext,
  type: Type,
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

  let contextRootType =
    context.getContextMap()[type.name] ||
    (!isRootOperationType(type.name) &&
      context.getContextMap()[
        context.getTypeFromTypeNode(field.type) as string
      ]);

  if (
    (type.kind === "OBJECT" || type.kind === "INTERFACE") &&
    !contextRootType &&
    type.interfaces.length
  ) {
    contextRootType = context.mergeContexts(type.interfaces);
  }

  let contextTypes;
  if (contextRootType) {
    if (contextRootType[field.name]) {
      contextTypes = contextRootType[field.name];
    } else if (contextRootType.__context) {
      contextTypes = contextRootType.__context;
    }
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
      context.getTypeReferenceFromTypeNode(field.type, "RESOLVERS"),
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

  let contextRootType = context.getContextMap()[type.name];

  if (!contextRootType && type.types.length) {
    contextRootType = context.mergeContexts(type.types);
  }

  const contextTypes = context.getContextTypes(contextRootType);

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
  let contextRootType = context.getContextMap()[type.name];

  if (!contextRootType && type.interfaces.length) {
    contextRootType = context.mergeContexts(type.interfaces);
  }

  const contextTypes = context.getContextTypes(contextRootType);

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
