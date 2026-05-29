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
            factory.createQualifiedName(
              factory.createIdentifier("Models"),
              type.name,
            ),
          ),
        ),
      ),
    ),
  );

  statements.push(
    factory.createInterfaceDeclaration(
      [factory.createToken(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier("PossibleTypesResultData"),
      undefined,
      undefined,
      [
        factory.createPropertySignature(
          undefined,
          factory.createIdentifier("possibleTypes"),
          undefined,
          factory.createTypeLiteralNode([
            factory.createIndexSignature(
              undefined,
              [
                factory.createParameterDeclaration(
                  undefined,
                  undefined,
                  factory.createIdentifier("key"),
                  undefined,
                  factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
                  undefined,
                ),
              ],
              factory.createArrayTypeNode(
                factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
              ),
            ),
          ]),
        ),
      ],
    ),
    factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createIdentifier("result"),
            undefined,
            factory.createTypeReferenceNode(
              factory.createIdentifier("PossibleTypesResultData"),
              undefined,
            ),
            factory.createObjectLiteralExpression(
              [
                factory.createPropertyAssignment(
                  factory.createStringLiteral("possibleTypes"),
                  factory.createObjectLiteralExpression(
                    allTypes
                      .filter((type) => type.kind === "UNION")
                      .map((union) =>
                        factory.createPropertyAssignment(
                          factory.createStringLiteral(union.name),
                          factory.createArrayLiteralExpression(
                            union.types.map((type) => {
                              return factory.createStringLiteral(type);
                            }),
                            true,
                          ),
                        ),
                      ),
                    true,
                  ),
                ),
              ],
              true,
            ),
          ),
        ],
        ts.NodeFlags.Const,
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
