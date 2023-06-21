import ts, { factory } from "typescript";
import { TsCodegenContext, EnumType } from "./context";

export function generateEnums(context: TsCodegenContext): ts.SourceFile {
  const enumsImport = context.getEnumsImport();
  const enumsStatements: ts.Statement[] = [];
  if (enumsImport) {
    enumsStatements.push(
      ...(context
        .getAllTypes()
        .map((type) => {
          if (type.kind === "ENUM") {
            return factory.createExportDeclaration(
              undefined,
              undefined,
              false,
              factory.createNamedExports([
                factory.createExportSpecifier(
                  false,
                  undefined,
                  factory.createIdentifier(type.name),
                ),
              ]),
              factory.createStringLiteral(enumsImport),
            );
          }
        })
        .filter(Boolean) as ts.Statement[]),
    );
  } else {
    enumsStatements.push(
      ...(context
        .getAllTypes()
        .filter((type) => type.kind === "ENUM")
        .flatMap((type) =>
          createEnumTypeModel(context, type as EnumType),
        ) as ts.Statement[]),
    );
  }

  const source = factory.createSourceFile(
    enumsStatements,
    factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );
  source.fileName = "enums.interface.ts";
  return source;
}

function createEnumTypeModel(
  context: TsCodegenContext,
  type: EnumType,
): ts.Statement[] {
  return [
    factory.createVariableStatement(
      [factory.createToken(ts.SyntaxKind.ExportKeyword)],
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createIdentifier(type.name),
            undefined,
            undefined,
            factory.createAsExpression(
              factory.createObjectLiteralExpression(
                type.values.map((value) =>
                  factory.createPropertyAssignment(
                    factory.createIdentifier(value),
                    factory.createStringLiteral(value),
                  ),
                ),
                true,
              ),
              factory.createTypeReferenceNode(
                factory.createIdentifier("const"),
                undefined,
              ),
            ),
          ),
        ],
        ts.NodeFlags.Const,
      ),
    ),
    factory.createTypeAliasDeclaration(
      [factory.createToken(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier(type.name),
      undefined,
      factory.createIndexedAccessTypeNode(
        factory.createTypeQueryNode(
          factory.createIdentifier(type.name),
          undefined,
        ),
        factory.createTypeOperatorNode(
          ts.SyntaxKind.KeyOfKeyword,
          factory.createTypeQueryNode(
            factory.createIdentifier(type.name),
            undefined,
          ),
        ),
      ),
    ),
  ];
}
