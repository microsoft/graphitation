import {
  Types,
  PluginValidateFn,
  PluginFunction,
} from "@graphql-codegen/plugin-helpers";
import { GraphQLSchema } from "graphql";
import { printSchema, parse } from "graphql";
import {
  encodeASTSchema,
  mergeSchemaDefinitions,
} from "@graphitation/supermassive";
import { extname } from "path";
import { RawClientSideBasePluginConfig } from "@graphql-codegen/visitor-plugin-common";

type PluginConfig = RawClientSideBasePluginConfig & {
  files: string[];
};

export const plugin: PluginFunction<PluginConfig> = (schema: GraphQLSchema) => {
  const schemaAST = parse(printSchema(schema));
  const typeDefs = mergeSchemaDefinitions(
    { types: {} },
    encodeASTSchema(schemaAST),
  );

  return `export default JSON.parse('${JSON.stringify(typeDefs)}')`;
};

export const validate: PluginValidateFn<PluginConfig> = async (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  config,
  outputFile: string,
) => {
  if (extname(outputFile) !== ".ts" && extname(outputFile) !== ".tsx") {
    throw new Error(
      `Plugin "graphql-codegen-supermassive-schema-extraction-plugin" requires extension to be ".ts" or ".tsx"!`,
    );
  }
};
