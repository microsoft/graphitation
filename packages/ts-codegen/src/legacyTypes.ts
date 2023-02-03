import ts, { factory } from "typescript";
import { DocumentNode } from "graphql";
import {
  TsCodegenContext,
  Type,
  UnionType,
  Field,
  ObjectType,
} from "./context";
import { createImportDeclaration } from "./context/utilities";
import {
  addModelSuffix,
  getResolverParameters,
  createUnionTypeResolvers,
  createNonNullableTemplate,
  camelCase,
} from "./utilities";

const ROOT_OPERATIONS = ["Query", "Mutation", "Subscription"];
const LEGACY_TYPES = ["OBJECT", "ENUM", "UNION", "INTERFACE", "SCALAR", "ENUM"];

export function generateLegacyTypes(
  context: TsCodegenContext,
  document: DocumentNode,
): ts.SourceFile {
  const legacyTypesExports = context
    .getAllTypes()
    .map(getLegacyTypeExport)
    .filter(Boolean) as ts.ExportSpecifier[];

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

  imports.push(...context.getBasicImports());
  const extra = [];

  extra.push(createLegacyResolversNamespace(context, context.getAllTypes()));
  extra.push(createLegacyCompatObject(context, context.getAllTypes()));

  const unionTypes = context
    .getAllTypes()
    .filter((type) => type.kind === "UNION") as UnionType[];

  extra.push(createLegacyResolverNamespace(context, unionTypes));

  const typesImports = context
    .getAllTypes()
    .map(getTypeImport)
    .filter(Boolean) as ts.ImportSpecifier[];

  const importDeclaration = factory.createImportDeclaration(
    undefined,
    undefined,
    factory.createImportClause(
      false,
      undefined,
      factory.createNamedImports(typesImports),
    ),
    factory.createStringLiteral("./models.interface"),
  ) as ts.Statement;

  imports.push(importDeclaration);

  const exportDeclaration = factory.createExportDeclaration(
    undefined,
    undefined,
    false,
    factory.createNamedExports(legacyTypesExports),
    undefined,
  ) as ts.Statement;

  return factory.createSourceFile(
    imports.concat(exportDeclaration).concat(...extra),
    factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );
}

function getTypeImport(type: Type): ts.ImportSpecifier | null {
  if (
    LEGACY_TYPES.includes(type.kind) &&
    !ROOT_OPERATIONS.includes(type.name)
  ) {
    return factory.createImportSpecifier(
      undefined,
      factory.createIdentifier(addModelSuffix(type.name)),
    );
  }
  return null;
}

function getLegacyTypeExport(type: Type): ts.ExportSpecifier | null {
  if (
    LEGACY_TYPES.includes(type.kind) &&
    !ROOT_OPERATIONS.includes(type.name)
  ) {
    return factory.createExportSpecifier(
      factory.createIdentifier(addModelSuffix(type.name)),
      factory.createIdentifier(type.name),
    );
  }
  return null;
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
      : addModelSuffix(type.name);

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
function createLegacyCompatObject(context: TsCodegenContext, types: Type[]) {
  return factory.createTypeAliasDeclaration(
    undefined,
    [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier("LegacyTypes"),
    undefined,
    factory.createTypeLiteralNode(
      types
        .map((type) => createLegacyCompatField(type))
        .filter((t) => t != null) as ts.PropertySignature[],
    ),
  );
}

function createLegacyCompatField(type: Type): ts.PropertySignature | null {
  if (type.kind === "INPUT_OBJECT" || ROOT_OPERATIONS.includes(type.name)) {
    return null;
  } else {
    return factory.createPropertySignature(
      undefined,
      factory.createIdentifier(type.name),
      undefined,
      factory.createTypeReferenceNode(
        factory.createIdentifier(addModelSuffix(type.name)),
      ),
    );
  }
}
