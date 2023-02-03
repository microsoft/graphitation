import ts, { factory } from "typescript";
import { DocumentNode } from "graphql";
import { TsCodegenContext, Type, UnionType, Field } from "./context";
import { createUnionTypeResolvers, camelCase } from "./utilities";

const ROOT_OPERATIONS = ["Query", "Mutation", "Subscription"];
const LEGACY_TYPES = ["OBJECT", "ENUM", "UNION", "INTERFACE", "SCALAR", "ENUM"];

export function generateLegacyResolvers(
  context: TsCodegenContext,
  document: DocumentNode,
): ts.SourceFile {
  const imports: ts.Statement[] = [];
  imports.push(
    factory.createImportDeclaration(
      undefined,
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamespaceImport(factory.createIdentifier("_Resolvers")),
      ),
      factory.createStringLiteral("./resolvers.interface"),
    ),
  );

  imports.push(
    factory.createImportDeclaration(
      undefined,
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamedImports(
          ROOT_OPERATIONS.map((operationName) =>
            factory.createImportSpecifier(
              factory.createIdentifier(operationName),
              factory.createIdentifier(`_${operationName}`),
            ),
          ),
        ),
      ),
      factory.createStringLiteral("./resolvers.interface"),
    ),
  );

  imports.push(
    factory.createImportDeclaration(
      undefined,
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamespaceImport(factory.createIdentifier("_LegacyTypes")),
      ),
      factory.createStringLiteral("./legacy-types.interface"),
    ),
  );

  imports.push(...context.getBasicImports());
  const extra = [];

  extra.push(createLegacyResolversNamespace(context, context.getAllTypes()));

  const unionTypes = context
    .getAllTypes()
    .filter((type) => type.kind === "UNION") as UnionType[];

  extra.push(createLegacyResolverNamespace(context, unionTypes));

  return factory.createSourceFile(
    imports.concat(...extra),
    factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );
}

function createLegacyResolverNamespace(
  context: TsCodegenContext,
  types: UnionType[],
): ts.ModuleDeclaration {
  const typeObjects: ts.Statement[] = [];

  context.getAllTypes().forEach((type) => {
    if (type.kind === "OBJECT" && ROOT_OPERATIONS.includes(type.name)) {
      typeObjects.push(
        ...type.fields.map((field) =>
          createRootOperationArgs(
            context,
            `${type.name}${camelCase(field.name, { pascalCase: true })}Args`,
            field,
          ),
        ),
        ...type.fields.map((field) =>
          createRootOperationArgs(
            context,
            `${camelCase(field.name, { pascalCase: true })}${type.name}Args`,
            field,
          ),
        ),
      );
    }
  });
  types.forEach((type) => {
    typeObjects.push(
      factory.createTypeAliasDeclaration(
        undefined,
        [factory.createToken(ts.SyntaxKind.ExportKeyword)],
        factory.createIdentifier(`${type.name}TypeResolvers`),
        undefined,
        factory.createTypeLiteralNode([
          factory.createPropertySignature(
            undefined,
            factory.createIdentifier("__resolveType"),
            undefined,
            createUnionTypeResolvers(context, type, true),
          ),
        ]),
      ),
    );
  });

  typeObjects.push(
    factory.createModuleDeclaration(
      undefined,
      [factory.createToken(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier("QueryResolvers"),
      factory.createModuleBlock([
        factory.createTypeAliasDeclaration(
          undefined,
          [factory.createToken(ts.SyntaxKind.ExportKeyword)],
          factory.createIdentifier("Resolvers"),
          undefined,
          factory.createTypeReferenceNode(
            factory.createQualifiedName(
              factory.createIdentifier("_LegacyResolvers"),
              factory.createIdentifier("Query"),
            ),
            undefined,
          ),
        ),
      ]),
      ts.NodeFlags.Namespace,
    ),
  );
  typeObjects.push(
    factory.createModuleDeclaration(
      undefined,
      [factory.createToken(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier("MutationResolvers"),
      factory.createModuleBlock([
        factory.createTypeAliasDeclaration(
          undefined,
          [factory.createToken(ts.SyntaxKind.ExportKeyword)],
          factory.createIdentifier("Resolvers"),
          undefined,
          factory.createTypeReferenceNode(
            factory.createQualifiedName(
              factory.createIdentifier("_LegacyResolvers"),
              factory.createIdentifier("Mutation"),
            ),
            undefined,
          ),
        ),
      ]),
      ts.NodeFlags.Namespace,
    ),
  );
  typeObjects.push(
    factory.createModuleDeclaration(
      undefined,
      [factory.createToken(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier("SubscriptionResolvers"),
      factory.createModuleBlock([
        factory.createTypeAliasDeclaration(
          undefined,
          [factory.createToken(ts.SyntaxKind.ExportKeyword)],
          factory.createIdentifier("Resolvers"),
          undefined,
          factory.createTypeReferenceNode(
            factory.createQualifiedName(
              factory.createIdentifier("_LegacyResolvers"),
              factory.createIdentifier("Subscription"),
            ),
            undefined,
          ),
        ),
      ]),
      ts.NodeFlags.Namespace,
    ),
  );

  return factory.createModuleDeclaration(
    undefined,
    [
      factory.createModifier(ts.SyntaxKind.ExportKeyword),
      factory.createModifier(ts.SyntaxKind.DeclareKeyword),
    ],
    factory.createIdentifier("LegacyResolvers"),
    factory.createModuleBlock(typeObjects),
    ts.NodeFlags.Namespace,
  );
}

function createRootOperationArgs(
  context: TsCodegenContext,
  typeName: string,
  field: Field,
): ts.TypeAliasDeclaration {
  const resolverParametersDefinitions = field.arguments.map(({ name, type }) =>
    factory.createPropertySignature(
      [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
      factory.createIdentifier(name),
      undefined,
      context.getTypeReferenceForInputTypeFromTypeNode(type, "LEGACY"),
    ),
  );

  return factory.createTypeAliasDeclaration(
    undefined,
    [factory.createToken(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier(typeName),
    undefined,
    factory.createTypeLiteralNode(resolverParametersDefinitions),
  );
}

function createLegacyResolversNamespace(
  context: TsCodegenContext,
  types: Type[],
): ts.ModuleDeclaration {
  const typeObjects: ts.Statement[] = [];
  types.forEach((type) => {
    const typeName = ROOT_OPERATIONS.includes(type.name)
      ? `_${type.name}`
      : `_LegacyTypes.${type.name}`;

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
              ROOT_OPERATIONS.includes(type.name)
                ? factory.createTypeReferenceNode(
                    factory.createQualifiedName(
                      factory.createIdentifier(typeName),
                      factory.createIdentifier(field.name),
                    ),
                    undefined,
                  )
                : factory.createIndexedAccessTypeNode(
                    factory.createTypeReferenceNode(
                      factory.createIdentifier(typeName),
                      undefined,
                    ),
                    factory.createLiteralTypeNode(
                      factory.createStringLiteral(field.name),
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
