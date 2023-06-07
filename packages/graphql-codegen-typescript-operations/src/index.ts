import { PluginFunction, Types } from "@graphql-codegen/plugin-helpers";
import {
  visit,
  concatAST,
  GraphQLSchema,
  Kind,
  DocumentNode,
  FragmentDefinitionNode,
} from "graphql";
import { TypeScriptDocumentsVisitor } from "./visitor";
import {
  LoadedFragment,
  optimizeOperations,
} from "@graphql-codegen/visitor-plugin-common";
import { TypeScriptDocumentsPluginConfig } from "./config";

export { TypeScriptDocumentsPluginConfig } from "./config";

export const plugin: PluginFunction<
  TypeScriptDocumentsPluginConfig,
  Types.ComplexPluginOutput
> = (
  schema: GraphQLSchema,
  rawDocuments: Types.DocumentFile[],
  config: TypeScriptDocumentsPluginConfig,
) => {
  const documents = config.flattenGeneratedTypes
    ? optimizeOperations(schema, rawDocuments)
    : rawDocuments;
  const allAst = concatAST(
    documents.map((v) => v.document).filter(Boolean) as DocumentNode[],
  );

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

  const visitor = new TypeScriptDocumentsVisitor(schema, config, allFragments);

  const visitorResult = visit(allAst, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    leave: visitor as any,
  });

  let content = visitorResult.definitions.join("\n");

  if (config.addOperationExport) {
    const exportConsts: string[] = [];

    allAst.definitions.forEach((d) => {
      if ("name" in d) {
        exportConsts.push(
          `export declare const ${d.name?.value}: import("graphql").DocumentNode;`,
        );
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content = (visitorResult.definitions as any)
      .concat(exportConsts)
      .join("\n");
  }

  if (config.globalNamespace) {
    content = `
    declare global { 
      ${content} 
    }`;
  }

  return {
    prepend: [
      ...visitor.getImports(),
      ...visitor.getGlobalDeclarations(visitor.config.noExport),
    ],
    content,
  };
};

export { TypeScriptDocumentsVisitor };
