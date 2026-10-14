import ts, { factory } from "typescript";
import { BUILT_IN_SCALARS, TsCodegenContext } from "./context";

const ROOT_OPERATIONS = ["Query", "Mutation", "Subscription"];
const LEGACY_TYPES = [
  "OBJECT",
  "INPUT_OBJECT",
  "ENUM",
  "UNION",
  "INTERFACE",
  "SCALAR",
  "ENUM",
];

export function generateLegacyTypes(context: TsCodegenContext): ts.SourceFile {
  const statements: ts.Statement[] = [];
  const schemaTypes = Array.from(
    new Map(context.getAllTypes().map((type) => [type.name, type])).values(),
  );
  const allTypes = schemaTypes.filter(
    (type) =>
      LEGACY_TYPES.includes(type.kind) && !ROOT_OPERATIONS.includes(type.name),
  );

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

  statements.push(
    factory.createExportDeclaration(
      undefined,
      false,
      undefined,
      factory.createStringLiteral("./models.interface"),
    ),
  );

  if (context.hasEnums) {
    statements.push(
      factory.createExportDeclaration(
        undefined,
        false,
        undefined,
        factory.createStringLiteral("./enums.interface"),
      ),
    );
  }

  statements.push(
    factory.createInterfaceDeclaration(
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier("Scalars"),
      undefined,
      undefined,
      Object.keys(BUILT_IN_SCALARS)
        .map((name: keyof typeof BUILT_IN_SCALARS) =>
          factory.createPropertySignature(
            [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
            name,
            undefined,
            factory.createTypeReferenceNode(BUILT_IN_SCALARS[name]),
          ),
        )
        .concat(
          allTypes
            .filter(
              (type) =>
                type.kind === "SCALAR" &&
                !Object.prototype.hasOwnProperty.call(
                  BUILT_IN_SCALARS,
                  type.name,
                ),
            )
            .map((type) =>
              factory.createPropertySignature(
                [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
                type.name,
                undefined,
                createModelReference(type.name),
              ),
            ),
        ),
    ),
  );

  const scalarNames = new Set([
    ...Object.keys(BUILT_IN_SCALARS),
    ...schemaTypes
      .filter((type) => type.kind === "SCALAR")
      .map((type) => type.name),
  ]);
  const typeNames = new Set([
    ...scalarNames,
    ...schemaTypes.map((type) => type.name),
  ]);
  statements.push(
    factory.createTypeAliasDeclaration(
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      "TypeMap",
      undefined,
      factory.createTypeLiteralNode(
        Array.from(typeNames)
          .filter((name) => !name.startsWith("__"))
          .sort()
          .map((name) =>
            factory.createPropertySignature(
              undefined,
              factory.createStringLiteral(name),
              undefined,
              scalarNames.has(name)
                ? createScalarReference(name)
                : createModelReference(name),
            ),
          ),
      ),
    ),
  );

  statements.push(
    factory.createInterfaceDeclaration(
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier("Types"),
      undefined,
      undefined,
      allTypes.map((type) =>
        factory.createPropertySignature(
          [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
          type.name,
          undefined,
          Object.prototype.hasOwnProperty.call(BUILT_IN_SCALARS, type.name)
            ? createScalarReference(type.name)
            : createModelReference(type.name),
        ),
      ),
    ),
  );

  const source = factory.createSourceFile(
    statements,
    factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );
  source.fileName = "legacy-types.interface.ts";
  return source;
}

function createScalarReference(name: string): ts.IndexedAccessTypeNode {
  return factory.createIndexedAccessTypeNode(
    factory.createTypeReferenceNode("Scalars"),
    factory.createLiteralTypeNode(factory.createStringLiteral(name)),
  );
}

function createModelReference(name: string): ts.TypeReferenceNode {
  return factory.createTypeReferenceNode(
    factory.createQualifiedName(factory.createIdentifier("Models"), name),
  );
}
