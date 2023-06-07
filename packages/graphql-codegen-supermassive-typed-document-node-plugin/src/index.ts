/*
 * Taken from https://github.com/dotansimha/graphql-code-generator/blob/4fee8c8c523b30163e913438b85a064c58e39087/packages/plugins/typescript/typed-document-node/src/index.ts
 * MIT license https://github.com/dotansimha/graphql-code-generator/blob/4fee8c8c523b30163e913438b85a064c58e39087/LICENSE
 */

import {
  Types,
  PluginValidateFn,
  PluginFunction,
} from "@graphql-codegen/plugin-helpers";
import {
  visit,
  concatAST,
  GraphQLSchema,
  Kind,
  FragmentDefinitionNode,
  DocumentNode,
  DefinitionNode,
} from "graphql";
import { extname } from "path";
import {
  LoadedFragment,
  RawClientSideBasePluginConfig,
  DocumentMode,
} from "@graphql-codegen/visitor-plugin-common";
import { TypeScriptDocumentNodesVisitor } from "./visitor";

export const plugin: PluginFunction<RawClientSideBasePluginConfig> = (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  config: RawClientSideBasePluginConfig,
) => {
  const allAst = concatAST(documents.map((v) => v.document as DocumentNode));

  const allFragments: LoadedFragment[] = [
    ...(
      allAst.definitions.filter(
        (d) => d.kind === Kind.FRAGMENT_DEFINITION,
      ) as FragmentDefinitionNode[]
    ).map((fragmentDef) => ({
      node: fragmentDef,
      name: fragmentDef.name.value,
      onType: fragmentDef.typeCondition.name.value,
      isExternal: false,
    })),
    ...(config.externalFragments || []),
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visitor: any = new TypeScriptDocumentNodesVisitor(
    schema,
    allFragments,
    config,
    documents,
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visitorResult = visit(allAst, { leave: visitor as any });

  return {
    prepend: allAst.definitions.length === 0 ? [] : visitor.getImports(),
    content: [
      visitor.fragments,
      ...visitorResult.definitions.filter(
        (t: DefinitionNode) => typeof t === "string",
      ),
    ].join("\n"),
  };
};

export const validate: PluginValidateFn<RawClientSideBasePluginConfig> = async (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
  outputFile: string,
) => {
  if (config && config.documentMode === DocumentMode.string) {
    throw new Error(
      `Plugin "supermassive-typed-document-node" does not allow using 'documentMode: string' configuration!`,
    );
  }

  if (extname(outputFile) !== ".ts" && extname(outputFile) !== ".tsx") {
    throw new Error(
      `Plugin "supermassive-typed-document-node" requires extension to be ".ts" or ".tsx"!`,
    );
  }
};
