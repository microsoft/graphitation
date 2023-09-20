import {
  Types,
  PluginValidateFn,
  PluginFunction,
} from "@graphql-codegen/plugin-helpers";
import ts from "typescript";
import { GraphQLSchema } from "graphql";
import { printSchema, parse } from "graphql";
import { extractImplicitTypesToTypescript } from "@graphitation/supermassive-extractors";
import { extname } from "path";
import { RawClientSideBasePluginConfig } from "@graphql-codegen/visitor-plugin-common";

type PluginConfig = RawClientSideBasePluginConfig & {
  files: string[];
};

export const plugin: PluginFunction<PluginConfig> = (schema: GraphQLSchema) => {
  const tsContents: ts.SourceFile = extractImplicitTypesToTypescript(
    parse(printSchema(schema)),
  );

  const printer = ts.createPrinter();

  return printer.printNode(ts.EmitHint.SourceFile, tsContents, tsContents);
};

export const validate: PluginValidateFn<PluginConfig> = async (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  config,
  outputFile: string,
) => {
  if (extname(outputFile) !== ".ts" && extname(outputFile) !== ".tsx") {
    throw new Error(
      `Plugin "supermassive-typed-document-node" requires extension to be ".ts" or ".tsx"!`,
    );
  }
};
