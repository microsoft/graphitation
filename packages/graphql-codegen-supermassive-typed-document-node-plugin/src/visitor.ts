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
import { addLegacyTypesToRequestDocument as addTypesToRequestDocument } from "@graphitation/supermassive-ast";
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

    autoBind(this);

    // We need to make sure it's there because in this mode, the base plugin doesn't add the import
    if (this.config.documentMode === DocumentMode.graphQLTag) {
      const documentNodeImport = this._parseImport(
        this.config.documentNodeImport || "graphql#DocumentNode",
      );
      const tagImport = this._generateImport(
        documentNodeImport,
        "DocumentNode",
        true,
      ) as string;
      this._imports.add(tagImport);
    }
  }

  protected _gql(
    node: FragmentDefinitionNode | OperationDefinitionNode,
  ): string {
    if (this.config.supermassiveDocumentNodeConditional) {
      const supermassive = this._render(node, true);
      const standard = this._render(node, false);
      return `(${this.config.supermassiveDocumentNodeConditional}\n? ${supermassive}\n: ${standard})`;
    }
    return this._render(node, true);
  }

  protected _render(
    node: FragmentDefinitionNode | OperationDefinitionNode,
    annotate = false,
  ): string {
    const supermassiveNode = addTypesToRequestDocument(this._schema, {
      kind: Kind.DOCUMENT,
      definitions: [node],
    }).definitions[0] as FragmentDefinitionNode | OperationDefinitionNode;

    const fragments = this._transformFragments(supermassiveNode);

    const doc = this._prepareDocument(`
    ${
      print(supermassiveNode)
        .split("\\")
        .join("\\\\") /* Re-escape escaped values in GraphQL syntax */
    }
    ${this._includeFragments(fragments)}`);

    if (this.config.documentMode === DocumentMode.documentNode) {
      let gqlObj = gqlTag([doc]);

      if (this.config.optimizeDocumentNode) {
        gqlObj = optimizeDocumentNode(gqlObj);
      }
      if (annotate) {
        gqlObj = this._transformDocumentNodeToSupermassive(gqlObj);
      }

      return JSON.stringify(gqlObj);
    } else if (
      this.config.documentMode === DocumentMode.documentNodeImportFragments
    ) {
      let gqlObj = gqlTag([doc]);

      if (this.config.optimizeDocumentNode) {
        gqlObj = optimizeDocumentNode(gqlObj);
      }

      if (fragments.length > 0) {
        const definitions = [
          ...gqlObj.definitions.map((t) =>
            JSON.stringify(
              annotate
                ? addTypesToRequestDocument(this._schema, {
                    kind: Kind.DOCUMENT,
                    definitions: [t],
                  }).definitions[0]
                : t,
            ),
          ),
          ...fragments.map((name) => `...${name}.definitions`),
        ].join();

        return `{"kind":"${Kind.DOCUMENT}","definitions":[${definitions}]}`;
      }
      if (annotate) {
        gqlObj = this._transformDocumentNodeToSupermassive(gqlObj);
      }

      return JSON.stringify(gqlObj);
    } else if (this.config.documentMode === DocumentMode.string) {
      return "`" + doc + "`";
    }

    const gqlImport = this._parseImport(this.config.gqlImport || "graphql-tag");

    return (gqlImport.propName || "gql") + "`" + doc + "`";
  }

  private _transformDocumentNodeToSupermassive(document: DocumentNode) {
    return {
      ...document,
      definitions: document.definitions.map(
        (t) =>
          addTypesToRequestDocument(this._schema, {
            kind: Kind.DOCUMENT,
            definitions: [t],
          }).definitions[0],
      ),
    } as DocumentNode;
  }
  protected getDocumentNodeSignature(
    resultType: string,
    variablesTypes: string,
    node: FragmentDefinitionNode | OperationDefinitionNode,
  ) {
    if (
      this.config.documentMode === DocumentMode.documentNode ||
      this.config.documentMode === DocumentMode.documentNodeImportFragments ||
      this.config.documentMode === DocumentMode.graphQLTag
    ) {
      return ` as unknown as DocumentNode<${resultType}, ${variablesTypes}>`;
    }

    return super.getDocumentNodeSignature(resultType, variablesTypes, node);
  }
}
