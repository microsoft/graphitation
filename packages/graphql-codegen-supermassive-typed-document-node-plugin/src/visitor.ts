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
  Kind,
  OperationDefinitionNode,
  parse,
} from "graphql";
import { addMinimalViableSchemaToRequestDocument } from "@graphitation/supermassive";
import { optimizeDocumentNode } from "@graphql-tools/optimize";
import gqlTag from "graphql-tag";
import { print } from "./utils/print";

export type SupermassiveAstType = "SupermassiveV3" | "Lazy" | "Standard";
export type RuntimeParseImport = { moduleName: string; propName: string };

type RawClientSidePluginConfig = RawClientSideBasePluginConfig & {
  runtimeParseImport?: RuntimeParseImport;
  astType?: SupermassiveAstType;
};
type ClientSidePluginConfig = ClientSideBasePluginConfig & {
  astType?: SupermassiveAstType;
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
        astType: rawConfig.astType ?? "SupermassiveV3",
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

    if (this.config.astType === "Lazy") {
      const { runtimeParseImport } = rawConfig;
      if (!validateRuntimeParseImport(runtimeParseImport)) {
        throw new Error(
          `graphql-codegen-supermassive-typed-document-node-plugin: astType="Lazy" requires valid runtimeParseImport in the config`,
        );
      }

      const tagImport = this._generateImport(
        runtimeParseImport,
        "runtimeParse",
        false,
      ) as string;
      this._imports.add(tagImport);
    }
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

  protected _gql(
    node: FragmentDefinitionNode | OperationDefinitionNode,
  ): string {
    switch (this.config.astType) {
      case "Lazy":
        return this._renderLazy(node);

      case "SupermassiveV3":
        return this._render(node, true);

      case "Standard":
      default:
        return this._render(node, false);
    }
  }

  private _renderLazy(
    node: FragmentDefinitionNode | OperationDefinitionNode,
  ): string {
    const fragments = this._transformFragments(node);
    const doc = this._prepareDocument(`
    ${print(node)}
    ${this._includeFragments(fragments)}
    `);

    const gqlObj = parse(doc, { noLocation: true });
    return `
{
  kind: "Document",
  get definitions() {
    const document = runtimeParse('${print(gqlObj)}');
    delete this.definitions;
    return (this.definitions = ${
      !fragments.length
        ? "document.definitions"
        : `[${[
            "...document.definitions",
            ...fragments.map((name) => `...${name}.definitions`),
          ].join(",")}]`
    });
   }
}`;
  }

  private _render(
    node: FragmentDefinitionNode | OperationDefinitionNode,
    annotate = false,
  ): string {
    const supermassiveNode = this.addTypesToRequestDocument(this._schema, {
      kind: Kind.DOCUMENT,
      definitions: [node],
    }).definitions[0] as FragmentDefinitionNode | OperationDefinitionNode;

    const fragments = this._transformFragments(supermassiveNode);

    const doc = this._prepareDocument(`
    ${print(supermassiveNode)}
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
                ? this.addTypesToRequestDocument(this._schema, {
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
          this.addTypesToRequestDocument(this._schema, {
            kind: Kind.DOCUMENT,
            definitions: [t],
          }).definitions[0],
      ),
    } as DocumentNode;
  }

  private addTypesToRequestDocument(
    schema: GraphQLSchema,
    document: DocumentNode,
  ) {
    let finalDocument = document;
    if (this.config.astType === "SupermassiveV3") {
      finalDocument = addMinimalViableSchemaToRequestDocument(
        schema,
        finalDocument,
        {
          addTo: "PROPERTY",
        },
      );
    }
    return finalDocument;
  }
}

function validateRuntimeParseImport(
  input: unknown,
): input is RuntimeParseImport {
  const parseImport = input as RuntimeParseImport;
  return (
    typeof parseImport === "object" &&
    !!parseImport.moduleName &&
    !!parseImport.propName
  );
}
