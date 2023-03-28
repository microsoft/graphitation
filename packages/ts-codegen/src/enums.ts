import ts, { factory } from "typescript";
import { DocumentNode } from "graphql";
import { TsCodegenContext, Type, EnumType } from "./context";
import { addModelSuffix, createNonNullableTemplate } from "./utilities";

export function generateEnums(
  context: TsCodegenContext,
  document: DocumentNode,
): ts.SourceFile {
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
): ts.EnumDeclaration {
  return factory.createEnumDeclaration(
    undefined,
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
