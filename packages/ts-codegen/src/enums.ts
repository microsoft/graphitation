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
        .map((type) =>
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
): ts.EnumDeclaration | ts.TypeAliasDeclaration {
  if (context.legacyEnumsCompatibility()) {
    return factory.createEnumDeclaration(
      [
        factory.createModifier(ts.SyntaxKind.ExportKeyword),
        // factory.createModifier(ts.SyntaxKind.ConstKeyword),
      ],
      type.name,
      type.values.map((name) =>
        factory.createEnumMember(name, factory.createStringLiteral(name)),
      ),
    );
  }
  return factory.createTypeAliasDeclaration(
    [factory.createToken(ts.SyntaxKind.ExportKeyword)],
    factory.createIdentifier(type.name),
    undefined,
    factory.createUnionTypeNode(
      type.values.map((name) =>
        factory.createLiteralTypeNode(factory.createStringLiteral(name)),
      ),
    ),
  );
}
