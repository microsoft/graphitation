import ts, { factory } from "typescript";
import { TsCodegenContext, Field } from "./context";
import { camelCase } from "./utilities";

export function generateLegacyResolvers(
  context: TsCodegenContext,
): ts.SourceFile {
  const imports: ts.Statement[] = []; //context.getBasicImports();
  imports.push(
    factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamespaceImport(factory.createIdentifier("Resolvers")),
      ),
      factory.createStringLiteral("./resolvers.interface"),
    ),
  );

  imports.push(
    factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamespaceImport(factory.createIdentifier("Types")),
      ),
      factory.createStringLiteral("./models.interface"),
    ),
  );

  const extra = [];

  extra.push(createLegacyArgsNamespace(context));

  extra.push(...createLegacyResolverNamespace(context));

  const source = factory.createSourceFile(
    imports.concat(...extra),
    factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );
  source.fileName = "legacy-resolvers.interface.ts";
  return source;
}

function createLegacyArgsNamespace(context: TsCodegenContext) {
  const args: ts.Statement[] = [];
  context.getAllTypes().forEach((type) => {
    if (type.kind === "OBJECT") {
      args.push(
        ...type.fields
          .filter((field) => field.arguments && field.arguments.length > 0)
          .map((field) =>
            createFieldArgs(
              context,
              `${type.name}${camelCase(field.name, { pascalCase: true })}Args`,
              field,
            ),
          ),
      );
    }
  });

  return factory.createModuleDeclaration(
    [
      factory.createModifier(ts.SyntaxKind.ExportKeyword),
      factory.createModifier(ts.SyntaxKind.DeclareKeyword),
    ],
    factory.createIdentifier("Args"),
    factory.createModuleBlock(args),
    ts.NodeFlags.Namespace,
  );
}

function createLegacyResolverNamespace(
  context: TsCodegenContext,
): ts.Statement[] {
  const typeObjects: ts.Statement[] = [];

  context.getAllTypes().forEach((type) => {
    if (type.kind === "OBJECT") {
      typeObjects.push(
        factory.createModuleDeclaration(
          [factory.createToken(ts.SyntaxKind.ExportKeyword)],
          factory.createIdentifier(`${type.name}Resolvers`),
          factory.createModuleBlock([
            factory.createTypeAliasDeclaration(
              [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
              factory.createIdentifier("Resolvers"),
              undefined,
              factory.createTypeReferenceNode(
                factory.createQualifiedName(
                  factory.createQualifiedName(
                    factory.createIdentifier("Resolvers"),
                    factory.createIdentifier(type.name),
                  ),
                  factory.createIdentifier("Resolvers"),
                ),
              ),
            ),
          ]),
          ts.NodeFlags.Namespace,
        ),
      );
    } else if (type.kind === "UNION" || type.kind === "INTERFACE") {
      typeObjects.push(
        factory.createTypeAliasDeclaration(
          [factory.createToken(ts.SyntaxKind.ExportKeyword)],
          factory.createIdentifier(`${type.name}TypeResolvers`),
          undefined,
          factory.createTypeReferenceNode(
            factory.createQualifiedName(
              factory.createQualifiedName(
                factory.createIdentifier("Resolvers"),
                factory.createIdentifier(type.name),
              ),
              factory.createIdentifier("Resolvers"),
            ),
            undefined,
          ),
        ),
      );
    }
  });

  return typeObjects;
}

function createFieldArgs(
  context: TsCodegenContext,
  typeName: string,
  field: Field,
): ts.TypeAliasDeclaration {
  const resolverParametersDefinitions = field.arguments.map(({ name, type }) =>
    factory.createPropertySignature(
      [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
      factory.createIdentifier(name),
      type.kind !== "NonNullType"
        ? factory.createToken(ts.SyntaxKind.QuestionToken)
        : undefined,
      context.getTypeReferenceForInputTypeFromTypeNode(type, "LEGACY"),
    ),
  );

  return factory.createTypeAliasDeclaration(
    [factory.createToken(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier(typeName),
    undefined,
    factory.createTypeLiteralNode(resolverParametersDefinitions),
  );
}
