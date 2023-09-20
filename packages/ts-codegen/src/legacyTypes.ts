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

  if (context.hasInputs) {
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
            .filter((type) => type.kind === "SCALAR")
            .map((type) =>
              factory.createPropertySignature(
                [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
                type.name,
                undefined,
                factory.createTypeReferenceNode(
                  factory.createQualifiedName(
                    factory.createIdentifier("Models"),
                    type.name,
                  ),
                ),
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
