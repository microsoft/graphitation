/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 * Taken from https://github.com/dotansimha/graphql-code-generator/blob/4fee8c8c523b30163e913438b85a064c58e39087/packages/plugins/typescript/typed-document-node/src/visitor.ts
 * MIT license https://github.com/dotansimha/graphql-code-generator/blob/4fee8c8c523b30163e913438b85a064c58e39087/LICENSE
 */

import autoBind from "auto-bind";
import { Types } from "@graphql-codegen/plugin-helpers";
import {
  LoadedFragment,
  ClientSideBaseVisitor,
  ClientSideBasePluginConfig,
  DocumentMode,
  RawClientSideBasePluginConfig,
} from "@graphql-codegen/visitor-plugin-common";
import {
  GraphQLSchema,
  FragmentDefinitionNode,
  DocumentNode,
  print,
  Kind,
  OperationDefinitionNode,
} from "graphql";
import { addTypesToRequestDocument } from "@graphitation/supermassive-ast";
import { optimizeDocumentNode } from "@graphql-tools/optimize";
import gqlTag from "graphql-tag";

type RawClientSidePluginConfig = RawClientSideBasePluginConfig & {
  supermassiveDocumentNodeConditional?: string;
};
type ClientSidePluginConfig = ClientSideBasePluginConfig & {
  supermassiveDocumentNodeConditional?: string;
};

export class TypeScriptDocumentNodesVisitor extends ClientSideBaseVisitor<
  RawClientSidePluginConfig,
  ClientSidePluginConfig
> {
  constructor(
    schema: GraphQLSchema,
    fragments: LoadedFragment[],
    rawConfig: RawClientSidePluginConfig,
    documents: Types.DocumentFile[],
  ) {
    super(
      schema,
      fragments,
      {
        documentMode: DocumentMode.documentNodeImportFragments,
        documentNodeImport:
          "@graphql-typed-document-node/core#TypedDocumentNode",
        ...rawConfig,
      },
      {
        supermassiveDocumentNodeConditional:
          rawConfig.supermassiveDocumentNodeConditional,
      },
      documents,
    );

    autoBind(this as any);

    // We need to make sure it's there because in (this as any) mode, the base plugin doesn't add the import
    if ((this as any).config.documentMode === DocumentMode.graphQLTag) {
      const documentNodeImport = (this as any)._parseImport(
        (this as any).config.documentNodeImport || "graphql#DocumentNode",
      );
      const tagImport = (this as any)._generateImport(
        documentNodeImport,
        "DocumentNode",
        true,
      ) as string;
      (this as any)._imports.add(tagImport);
    }
  }

  protected _gql(
    node: FragmentDefinitionNode | OperationDefinitionNode,
  ): string {
    if ((this as any).config.supermassiveDocumentNodeConditional) {
      const supermassive = (this as any)._render(node, true);
      const standard = (this as any)._render(node, false);
      return `(${
        (this as any).config.supermassiveDocumentNodeConditional
      }\n? ${supermassive}\n: ${standard})`;
    }
    return (this as any)._render(node, true);
  }

  protected _render(
    node: FragmentDefinitionNode | OperationDefinitionNode,
    annotate = false,
  ): string {
    const supermassiveNode = addTypesToRequestDocument((this as any)._schema, {
      kind: Kind.DOCUMENT,
      definitions: [node as any],
    } as any).definitions[0] as
      | FragmentDefinitionNode
      | OperationDefinitionNode;

    const fragments = (this as any)._transformFragments(supermassiveNode);

    const doc = (this as any)._prepareDocument(`
    ${
      print(supermassiveNode)
        .split("\\")
        .join("\\\\") /* Re-escape escaped values in GraphQL syntax */
    }
    ${(this as any)._includeFragments(fragments)}`);

    if ((this as any).config.documentMode === DocumentMode.documentNode) {
      let gqlObj: any = gqlTag([doc]);

      if ((this as any).config.optimizeDocumentNode) {
        gqlObj = optimizeDocumentNode(gqlObj as any);
      }
      if (annotate) {
        gqlObj = (this as any)._transformDocumentNodeToSupermassive(gqlObj);
      }

      return JSON.stringify(gqlObj);
    } else if (
      (this as any).config.documentMode ===
      DocumentMode.documentNodeImportFragments
    ) {
      let gqlObj: any = gqlTag([doc]);

      if ((this as any).config.optimizeDocumentNode) {
        gqlObj = optimizeDocumentNode(gqlObj as any);
      }

      if (fragments.length > 0) {
        const definitions = [
          ...gqlObj.definitions.map((t: any) =>
            JSON.stringify(
              annotate
                ? addTypesToRequestDocument((this as any)._schema, {
                    kind: Kind.DOCUMENT,
                    definitions: [t],
                  } as any).definitions[0]
                : t,
            ),
          ),
          ...fragments.map((name: any) => `...${name}.definitions`),
        ].join();

        return `{"kind":"${Kind.DOCUMENT}","definitions":[${definitions}]}`;
      }
      if (annotate) {
        gqlObj = (this as any)._transformDocumentNodeToSupermassive(gqlObj);
      }

      return JSON.stringify(gqlObj);
    } else if ((this as any).config.documentMode === DocumentMode.string) {
      return "`" + doc + "`";
    }

    const gqlImport = (this as any)._parseImport(
      (this as any).config.gqlImport || "graphql-tag",
    );

    return (gqlImport.propName || "gql") + "`" + doc + "`";
  }

  private _transformDocumentNodeToSupermassive(document: DocumentNode) {
    return {
      ...document,
      definitions: document.definitions.map(
        (t) =>
          addTypesToRequestDocument((this as any)._schema, {
            kind: Kind.DOCUMENT,
            definitions: [t as any],
          } as any).definitions[0],
      ),
    } as DocumentNode;
  }
  protected getDocumentNodeSignature(
    resultType: string,
    variablesTypes: string,
    node: FragmentDefinitionNode | OperationDefinitionNode,
  ) {
    if (
      (this as any).config.documentMode === DocumentMode.documentNode ||
      (this as any).config.documentMode ===
        DocumentMode.documentNodeImportFragments ||
      (this as any).config.documentMode === DocumentMode.graphQLTag
    ) {
      return ` as unknown as DocumentNode<${resultType}, ${variablesTypes}>`;
    }

    return super.getDocumentNodeSignature(resultType, variablesTypes, node);
  }
}
