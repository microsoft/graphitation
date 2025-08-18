import { parse, print } from "graphql";
import { optimizeDocumentNode } from "@graphql-tools/optimize";
import { reduceNodeWatchQueryTransform } from "./formatModuleTransforms/reduceNodeWatchQueryTransform";
import invariant from "invariant";
import { stripFragmentReferenceFieldSelectionTransform } from "./formatModuleTransforms/stripFragmentReferenceFieldSelectionTransform";
import { extractMetadataTransform } from "./formatModuleTransforms/extractMetadataTransform";
import { buildSchema, Source } from "graphql";
import { readFileSync } from "fs";
import dedupeJSONStringify from "relay-compiler/lib/util/dedupeJSONStringify";

import type { DocumentNode, GraphQLSchema } from "graphql";
import type { FormatModule } from "relay-compiler/lib/language/RelayLanguagePluginInterface";
import type { CompiledArtefactModule } from "./types";
import { Fragment } from "relay-compiler";

export type SupermassiveOutputType = "V3" | "V2" | "BOTH";

export interface FormatModuleOptions {
  emitDocuments: boolean;
  emitNarrowObservables: boolean;
  emitQueryDebugComments: boolean;
  emitSupermassiveDocuments: boolean;
  supermassiveDocumentNodeOutputType: SupermassiveOutputType;
  schema: string;
  unstable_emitExecutionDocumentText: boolean;
}

function printDocumentComment(document: DocumentNode) {
  return `/*\n${print(document).trim()}\n*/`;
}

function printDocument(document: DocumentNode) {
  return `
// Note: executionDocumentText is necessary for Lazy AST and build-time operations analysis
const executionDocumentText = \`${print(document).trim()}\`;
`;
}

export async function formatModuleFactory(
  options: FormatModuleOptions,
): Promise<FormatModule> {
  const schema =
    options.emitNarrowObservables || options.emitSupermassiveDocuments
      ? buildSchema(
          new Source(readFileSync(options.schema, "utf-8"), options.schema),
        )
      : null;

  let addSupermassiveLegacyTypesToRequestDocument:
    | undefined
    | typeof import("@graphitation/supermassive").addSupermassiveLegacyTypesToRequestDocument;
  let addMinimalViableSchemaToRequestDocument:
    | undefined
    | typeof import("@graphitation/supermassive").addMinimalViableSchemaToRequestDocument;
  if (options.emitSupermassiveDocuments) {
    ({
      addSupermassiveLegacyTypesToRequestDocument,
      addMinimalViableSchemaToRequestDocument,
    } = await import("@graphitation/supermassive"));
  }

  function generateExports(
    moduleName: string,
    docText: string,
    emitNarrowObservables: boolean,
  ) {
    const exports: CompiledArtefactModule = {};
    const originalDocument = parse(docText, { noLocation: true });
    const optimizedDocument = optimizeDocumentNode(originalDocument);

    if (!emitNarrowObservables) {
      exports.executionQueryDocument = optimizedDocument;
    } else {
      if (!moduleName.endsWith("WatchNodeQuery.graphql")) {
        exports.executionQueryDocument =
          stripFragmentReferenceFieldSelectionTransform(optimizedDocument);
      }

      invariant(schema, "Expected a schema instance");
      exports.watchQueryDocument = reduceNodeWatchQueryTransform(
        schema,
        optimizedDocument,
      );

      exports.metadata = extractMetadataTransform(exports.watchQueryDocument);
    }

    if (options.emitSupermassiveDocuments && exports.executionQueryDocument) {
      invariant(schema, "Expected a schema instance");
      exports.executionQueryDocument = addTypesToRequestDocument(
        schema,
        exports.executionQueryDocument,
        options.supermassiveDocumentNodeOutputType,
        addMinimalViableSchemaToRequestDocument,
        addSupermassiveLegacyTypesToRequestDocument,
      ) as DocumentNode;
    }

    return exports;
  }

  return ({ docText, hash, moduleName, typeText, definition }) => {
    const exports = options.emitDocuments
      ? docText &&
        generateExports(
          moduleName,
          docText,
          options.emitNarrowObservables &&
            definition.kind === "Request" &&
            definition.root.operation === "query",
        )
      : null;
    const reExportWatchNodeQuery =
      options.emitDocuments && definition.kind === "Fragment";

    const components = [
      typeText,
      exports &&
        options.unstable_emitExecutionDocumentText &&
        exports.executionQueryDocument &&
        printDocument(exports.executionQueryDocument),
      exports &&
        options.emitQueryDebugComments &&
        !options.unstable_emitExecutionDocumentText &&
        exports.executionQueryDocument &&
        printDocumentComment(exports.executionQueryDocument),
      exports &&
        options.emitQueryDebugComments &&
        exports.watchQueryDocument &&
        printDocumentComment(exports.watchQueryDocument),
      exports && printExports(exports),
      reExportWatchNodeQuery && printWatchNodeQueryReExport(definition),
    ].filter(Boolean) as string[];

    return `// @apollo-react-relay-duct-tape
/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
${hash ? `/* ${hash} */\n` : ""}
${components.join("\n\n")}`;
  };
}

// TODO: hould simply not emit a WatchNodeQuery refetchable directive when there already is a @refetchable directive
function printWatchNodeQueryReExport(definition: Fragment) {
  const refetchable =
    definition.directives.find(
      (d) => d.name === "refetchable" && d.loc.kind === "Source",
    ) ||
    definition.directives.find(
      (d) => d.name === "refetchable" && d.loc.kind === "Generated",
    );
  if (!refetchable) {
    return undefined;
  }
  const queryNameArg = refetchable.args[0];
  invariant(
    queryNameArg.name === "queryName" && queryNameArg.value.kind === "Literal",
    "Expected a @refetchable(queryName:) argument",
  );

  return `import { documents } from "./${queryNameArg.value.value}.graphql";\nexport default documents;`;
}

function printExports(exports: CompiledArtefactModule) {
  return `export const documents: import("@graphitation/apollo-react-relay-duct-tape-compiler").CompiledArtefactModule = ${dedupeJSONStringify(
    exports,
  )};\n\nexport default documents;`;
}

function addTypesToRequestDocument(
  schema: GraphQLSchema,
  document: DocumentNode,
  supermassiveDocumentNodeOutputType: SupermassiveOutputType,
  addMinimalViableSchemaToRequestDocument: any,
  addSupermassiveLegacyTypesToRequestDocument: any,
) {
  let finalDocument = document;
  if (
    supermassiveDocumentNodeOutputType === "V3" ||
    supermassiveDocumentNodeOutputType === "BOTH"
  ) {
    finalDocument = addMinimalViableSchemaToRequestDocument(
      schema,
      finalDocument,
      {
        addTo: "PROPERTY",
      },
    );
  }

  if (
    supermassiveDocumentNodeOutputType === "V2" ||
    supermassiveDocumentNodeOutputType === "BOTH" ||
    !supermassiveDocumentNodeOutputType
  ) {
    finalDocument = addSupermassiveLegacyTypesToRequestDocument(
      schema,
      finalDocument,
    ) as unknown as DocumentNode;
  }
  return finalDocument;
}
