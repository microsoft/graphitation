import { printSchemaWithDirectives } from "@graphql-tools/utils";
import ts, { factory, TypeAliasDeclaration } from "typescript";
import { ParsedMapper } from "@graphql-codegen/visitor-plugin-common";
import {
  Types,
  PluginFunction,
  addFederationReferencesToSchema,
} from "@graphql-codegen/plugin-helpers";
import { parse, visit, GraphQLSchema, printSchema } from "graphql";
import { ResolversModelsVisitor } from "./visitor";
import { ResolversModelsPluginConfig, MapperConfigValue } from "./config";

export const plugin: PluginFunction<
  ResolversModelsPluginConfig,
  Types.ComplexPluginOutput
> = (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  config: ResolversModelsPluginConfig,
) => {
  const transformedSchema = config.federation
    ? addFederationReferencesToSchema(schema)
    : schema;

  if (!config.modelIntersectionSuffix || !config.mappers) {
    return { content: "" };
  }

  const visitor = new ResolversModelsVisitor(config, transformedSchema);

  const printedSchema = config.federation
    ? printSchemaWithDirectives(transformedSchema)
    : printSchema(transformedSchema);
  const astNode = parse(printedSchema);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  visit(astNode, { leave: visitor } as any);

  const content = Object.entries(visitor.getValidMappers()).reduce(
    (acc, [typeName, model]) => {
      acc.push(
        ...getModelAST(
          typeName,
          model,
          config.modelIntersectionSuffix as string,
          config.namespacedImportName || "",
          config?.mappersConfig?.[typeName],
        ),
      );
      return acc;
    },
    [] as TypeAliasDeclaration[],
  );

  const tsContents = factory.createSourceFile(
    content,
    factory.createToken(ts.SyntaxKind.EndOfFileToken),
    0,
  );

  const printer = ts.createPrinter();

  return {
    content: printer.printNode(ts.EmitHint.SourceFile, tsContents, tsContents),
  };
};

function getOmittedFields(typeName: string, omitFields?: string[]) {
  if (!omitFields || !omitFields.length) {
    return;
  }
  return factory.createTypeAliasDeclaration(
    undefined,
    undefined,
    factory.createIdentifier(`${typeName}ModelOmitFields`),
    undefined,
    factory.createUnionTypeNode(
      omitFields.map((field) =>
        factory.createLiteralTypeNode(factory.createStringLiteral(field)),
      ),
    ),
  );
}

function getModelAST(
  typeName: string,
  mapper: ParsedMapper,
  modelIntersectionSuffix: string,
  namespacedImportName: string,
  mapperConfig?: MapperConfigValue,
) {
  if (!mapperConfig || !mapperConfig.extend) {
    return [
      factory.createTypeAliasDeclaration(
        [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        factory.createIdentifier(mapper.type),
        undefined,
        factory.createTypeReferenceNode(
          factory.createIdentifier(`${mapper.type}${modelIntersectionSuffix}`),
          undefined,
        ),
      ),
    ];
  }

  const omittedFields = getOmittedFields(typeName, mapperConfig.exclude);

  if (!omittedFields) {
    return [
      factory.createTypeAliasDeclaration(
        [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        factory.createIdentifier(mapper.type),
        undefined,
        factory.createIntersectionTypeNode([
          factory.createTypeReferenceNode(
            factory.createIdentifier(
              `${
                namespacedImportName ? namespacedImportName + "." : ""
              }${typeName}`,
            ),
            undefined,
          ),
          factory.createTypeReferenceNode(
            factory.createIdentifier(
              `${mapper.type}${modelIntersectionSuffix}`,
            ),
            undefined,
          ),
        ]),
      ),
    ];
  }

  return [
    omittedFields,
    factory.createTypeAliasDeclaration(
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier(mapper.type),
      undefined,
      factory.createIntersectionTypeNode([
        factory.createTypeReferenceNode(factory.createIdentifier("Omit"), [
          factory.createTypeReferenceNode(
            factory.createIdentifier(
              `${
                namespacedImportName ? namespacedImportName + "." : ""
              }${typeName}`,
            ),
            undefined,
          ),
          factory.createTypeReferenceNode(
            factory.createIdentifier(`${typeName}ModelOmitFields`),
            undefined,
          ),
        ]),
        factory.createTypeReferenceNode(
          factory.createIdentifier(`${mapper.type}${modelIntersectionSuffix}`),
          undefined,
        ),
      ]),
    ),
  ];
}

export { ResolversModelsVisitor };
