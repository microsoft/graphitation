import ts, { factory } from "typescript";
import { DocumentNode } from "graphql";
import { TsCodegenContext, Type, EnumType } from "./context";
import { addModelSuffix, createNonNullableTemplate } from "./utilities";

export function generateEnums(
  context: TsCodegenContext,
  document: DocumentNode,
): ts.SourceFile {
  const typesReExports = context
    .getAllTypes()
    .filter((type) => type.kind === "ENUM")
    .map((type) =>
      createEnumTypeModel(context, type as EnumType),
    ) as ts.Statement[];

  const source = factory.createSourceFile(
    typesReExports,
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
