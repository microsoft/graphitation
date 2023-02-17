import ts, { factory } from "typescript";
import { DocumentNode } from "graphql";
import { TsCodegenContext } from "./context";

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

export function generateLegacyTypes(
  context: TsCodegenContext,
  document: DocumentNode,
): ts.SourceFile {
  const statements: ts.Statement[] = [];
  const allTypes = context
    .getAllTypes()
    .filter(
      (type) =>
        LEGACY_TYPES.includes(type.kind) &&
        !ROOT_OPERATIONS.includes(type.name),
    );
  statements.push(
    factory.createImportDeclaration(
      undefined,
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
    factory.createImportDeclaration(
      undefined,
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamespaceImport(factory.createIdentifier("Resolvers")),
      ),
      factory.createStringLiteral("./resolvers.interface"),
    ),
  );

  statements.push(
    factory.createExportDeclaration(
      undefined,
      undefined,
      false,
      undefined,
      factory.createStringLiteral("./enums.interface"),
    ),
  );

  statements.push(
    factory.createInterfaceDeclaration(
      undefined,
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier("Types"),
      undefined,
      undefined,
      allTypes.map((type) =>
        factory.createPropertySignature(
          [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
          type.name,
          undefined,
          factory.createTypeReferenceNode(
            type.kind === "INPUT_OBJECT"
              ? factory.createQualifiedName(
                  factory.createIdentifier("Resolvers"),
                  type.name,
                )
              : factory.createQualifiedName(
                  factory.createIdentifier("Models"),
                  type.name,
                ),
          ),
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
