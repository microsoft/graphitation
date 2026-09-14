import { emit } from "./emit";
import { BUILT_IN_SCALARS, TsCodegenContext } from "./context";
import { GeneratedFile } from "./types";

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

export function generateLegacyTypes(context: TsCodegenContext): GeneratedFile {
  const statements: string[] = [];
  const allTypes = context
    .getAllTypes()
    .filter(
      (type) =>
        LEGACY_TYPES.includes(type.kind) &&
        !ROOT_OPERATIONS.includes(type.name),
    );

  statements.push(
    emit.createImportDeclaration(
      undefined,
      emit.createImportClause(
        false,
        undefined,
        emit.createNamespaceImport(emit.createIdentifier("Models")),
      ),
      emit.createStringLiteral("./models.interface"),
    ),
  );

  statements.push(
    emit.createExportDeclaration(
      undefined,
      false,
      undefined,
      emit.createStringLiteral("./models.interface"),
    ),
  );

  if (context.hasEnums) {
    statements.push(
      emit.createExportDeclaration(
        undefined,
        false,
        undefined,
        emit.createStringLiteral("./enums.interface"),
      ),
    );
  }

  statements.push(
    emit.createInterfaceDeclaration(
      [emit.createModifier("ExportKeyword")],
      "Scalars",
      undefined,
      undefined,
      Object.keys(BUILT_IN_SCALARS)
        .map((name: keyof typeof BUILT_IN_SCALARS) =>
          emit.createPropertySignature(
            [emit.createModifier("ReadonlyKeyword")],
            name,
            undefined,
            emit.createTypeReferenceNode(BUILT_IN_SCALARS[name]),
          ),
        )
        .concat(
          allTypes
            .filter((type) => type.kind === "SCALAR")
            .map((type) =>
              emit.createPropertySignature(
                [emit.createModifier("ReadonlyKeyword")],
                type.name,
                undefined,
                emit.createTypeReferenceNode(
                  emit.createQualifiedName(
                    emit.createIdentifier("Models"),
                    type.name,
                  ),
                ),
              ),
            ),
        ),
    ),
  );

  statements.push(
    emit.createInterfaceDeclaration(
      [emit.createModifier("ExportKeyword")],
      "Types",
      undefined,
      undefined,
      allTypes.map((type) =>
        emit.createPropertySignature(
          [emit.createModifier("ReadonlyKeyword")],
          type.name,
          undefined,
          emit.createTypeReferenceNode(
            emit.createQualifiedName(
              emit.createIdentifier("Models"),
              type.name,
            ),
          ),
        ),
      ),
    ),
  );

  const source = emit.createSourceFile(
    statements,
    emit.createToken("EndOfFileToken"),
    undefined,
  );
  source.fileName = "legacy-types.interface.ts";
  return source;
}
