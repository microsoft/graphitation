import { emit } from "./emit";
import { TsCodegenContext, EnumType } from "./context";
import { GeneratedFile } from "./types";

export function generateEnums(context: TsCodegenContext): GeneratedFile {
  const enumsImport = context.getEnumsImport();
  const enumsStatements: string[] = [];
  if (enumsImport) {
    enumsStatements.push(
      ...(context
        .getAllTypes()
        .map((type) => {
          if (type.kind === "ENUM") {
            const isStringUnion =
              context.isUseStringUnionsInsteadOfEnumsEnabled() &&
              context.shouldMigrateEnum(type.name);

            return emit.createExportDeclaration(
              undefined,
              isStringUnion,
              emit.createNamedExports([
                emit.createExportSpecifier(false, undefined, type.name),
              ]),
              emit.createStringLiteral(enumsImport),
            );
          }
        })
        .filter(Boolean) as string[]),
    );
  } else {
    enumsStatements.push(
      ...context
        .getAllTypes()
        .filter((type) => type.kind === "ENUM")
        .map((type) => createEnumTypeModel(context, type as EnumType)),
    );
  }

  const source = emit.createSourceFile(
    enumsStatements,
    emit.createToken("EndOfFileToken"),
    undefined,
  );
  source.fileName = "enums.interface.ts";
  return source;
}

function createEnumTypeModel(
  context: TsCodegenContext,
  type: EnumType,
): string {
  if (
    context.isUseStringUnionsInsteadOfEnumsEnabled() &&
    context.shouldMigrateEnum(type.name)
  ) {
    return emit.createTypeAliasDeclaration(
      [emit.createToken("ExportKeyword")],
      type.name,
      undefined,
      emit.createUnionTypeNode(
        type.values.map((name) =>
          emit.createLiteralTypeNode(emit.createStringLiteral(name)),
        ),
      ),
    );
  }
  return emit.createEnumDeclaration(
    [emit.createModifier("ExportKeyword")],
    type.name,
    type.values.map((name) =>
      emit.createEnumMember(name, emit.createStringLiteral(name)),
    ),
  );
}
