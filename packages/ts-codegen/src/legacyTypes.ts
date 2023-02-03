import ts, { factory } from "typescript";
import { DocumentNode } from "graphql";
import { TsCodegenContext, Type } from "./context";
import { addModelSuffix } from "./utilities";

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
    imports.concat(exportDeclaration),
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
