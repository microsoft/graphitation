import { emit } from "./emit";
import { TsCodegenContext, Field } from "./context";
import { camelCase } from "./utilities";
import { GeneratedFile } from "./types";

export function generateLegacyResolvers(
  context: TsCodegenContext,
): GeneratedFile {
  const imports: string[] = []; //context.getBasicImports();
  imports.push(
    emit.createImportDeclaration(
      undefined,
      emit.createImportClause(
        false,
        undefined,
        emit.createNamespaceImport(emit.createIdentifier("Resolvers")),
      ),
      emit.createStringLiteral("./resolvers.interface"),
    ),
  );

  if (context.hasModels) {
    imports.push(
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
  }

  const extra = [];

  extra.push(createLegacyArgsNamespace(context));

  extra.push(...createLegacyResolverNamespace(context));

  const source = emit.createSourceFile(
    imports.concat(...extra),
    emit.createToken("EndOfFileToken"),
    undefined,
  );
  source.fileName = "legacy-resolvers.interface.ts";
  return source;
}

function createLegacyArgsNamespace(context: TsCodegenContext) {
  const args: string[] = [];
  context.getAllTypes().forEach((type) => {
    if (type.kind === "OBJECT") {
      args.push(
        ...type.fields
          .filter((field) => field.arguments && field.arguments.length > 0)
          .map((field) =>
            createFieldArgs(
              context,
              `${type.name}${camelCase(field.name, { pascalCase: true })}Args`,
              field,
            ),
          ),
      );
    }
  });

  return emit.createModuleDeclaration(
    [
      emit.createModifier("ExportKeyword"),
      emit.createModifier("DeclareKeyword"),
    ],
    "Args",
    emit.createModuleBlock(args),
    undefined,
  );
}

function createLegacyResolverNamespace(context: TsCodegenContext): string[] {
  const typeObjects: string[] = [];

  context.getAllTypes().forEach((type) => {
    if (type.kind === "OBJECT") {
      typeObjects.push(
        emit.createModuleDeclaration(
          [emit.createToken("ExportKeyword")],
          `${type.name}Resolvers`,
          emit.createModuleBlock([
            emit.createTypeAliasDeclaration(
              [emit.createModifier("ExportKeyword")],
              "Resolvers",
              undefined,
              emit.createTypeReferenceNode(
                emit.createQualifiedName(
                  emit.createQualifiedName(
                    emit.createIdentifier("Resolvers"),
                    type.name,
                  ),
                  "Resolvers",
                ),
              ),
            ),
          ]),
          undefined,
        ),
      );
    } else if (type.kind === "UNION" || type.kind === "INTERFACE") {
      typeObjects.push(
        emit.createTypeAliasDeclaration(
          [emit.createToken("ExportKeyword")],
          `${type.name}TypeResolvers`,
          undefined,
          emit.createTypeReferenceNode(
            emit.createQualifiedName(
              emit.createQualifiedName(
                emit.createIdentifier("Resolvers"),
                type.name,
              ),
              "Resolvers",
            ),
            undefined,
          ),
        ),
      );
    }
  });

  return typeObjects;
}

function createFieldArgs(
  context: TsCodegenContext,
  typeName: string,
  field: Field,
): string {
  const resolverParametersDefinitions = field.arguments.map(({ name, type }) =>
    emit.createPropertySignature(
      [emit.createModifier("ReadonlyKeyword")],
      emit.createIdentifier(name),
      type.kind !== "NonNullType"
        ? emit.createToken("QuestionToken")
        : undefined,
      context.getTypeReferenceForInputTypeFromTypeNode(type, "RESOLVERS"),
    ),
  );

  return emit.createTypeAliasDeclaration(
    [emit.createToken("ExportKeyword")],
    typeName,
    undefined,
    emit.createTypeLiteralNode(resolverParametersDefinitions),
  );
}
