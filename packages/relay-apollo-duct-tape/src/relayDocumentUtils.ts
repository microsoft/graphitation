import { transform as transformToIR } from "./vendor/relay-compiler/lib/core/RelayParser";
import CompilerContext from "./vendor/relay-compiler/lib/core/CompilerContext";
import { create as createSchema } from "./vendor/relay-compiler/lib/core/Schema";
import * as FlattenTransform from "./vendor/relay-compiler/lib/transforms/FlattenTransform";
import * as InlineFragmentsTransform from "./vendor/relay-compiler/lib/transforms/InlineFragmentsTransform";
import { generate as generateIRDocument } from "./vendor/relay-compiler/lib/codegen/RelayCodeGenerator";
import { SchemaDefinitions, decodeASTSchema } from "@graphitation/supermassive";

import { Source, print as printGraphQLJS } from "graphql";
import hash from "@emotion/hash";

import type { DefinitionNode, DocumentNode } from "graphql";
import type { Schema } from "./vendor/relay-compiler/lib/core/Schema";
import type { Request } from "relay-compiler/lib/core/IR";
import { keyArgsTransform } from "./keyArgsTransform";
import { TypePolicies } from "@apollo/client";

export function transformDocumentWithSupermassiveMVS(
  document: DocumentNode,
  addHash: boolean,
  typePolicies: TypePolicies,
) {
  const defs: SchemaDefinitions[] = [
    document.definitions && (document.definitions[0] as any).__defs,
  ];
  if (!defs) {
    return null;
  }
  const schema = transformSchema(decodeASTSchema(defs));
  return transformDocument(schema, document, addHash, typePolicies);
}

// TODO: Hash input document instead, which means memoization can skip
//       actually applying this transform.
export function transformDocument(
  schema: Schema,
  document: DocumentNode,
  addHash: boolean,
  typePolicies: TypePolicies,
) {
  const nodes = transformToIR(
    schema,
    // TODO: Add test with multiple references to the same fragment
    // And is this still necessary if we already do it in Cache.transformDocument
    // NOTE: graphql-codegen operations plugin has a dedupeFragments option for this, is it helpful?
    (document.definitions as DefinitionNode[]).filter(uniqueFilter),
  );
  let compilerContext = new CompilerContext(schema);
  for (const node of nodes) {
    compilerContext = compilerContext.add(node);
  }
  const operationCompilerContext = compilerContext
    .applyTransform(InlineFragmentsTransform.transform)
    .applyTransform(keyArgsTransform(typePolicies));
  const fragmentCompilerContext = compilerContext
    .applyTransform(
      FlattenTransform.transformWithOptions({
        isForCodegen: true,
      } as any),
    )
    .applyTransform(keyArgsTransform(typePolicies));

  const res: any[] = [];
  operationCompilerContext.forEachDocument((node) => {
    if (node.kind === "Root") {
      const fragment = operationCompilerContext.getRoot(node.name);
      const name = fragment.name;
      const request: Request = {
        kind: "Request",
        fragment: {
          kind: "Fragment",
          name,
          argumentDefinitions: fragment.argumentDefinitions,
          directives: fragment.directives,
          loc: { kind: "Derived", source: node.loc },
          metadata: undefined,
          selections: fragment.selections as any,
          type: fragment.type,
        },
        id: undefined,
        loc: node.loc,
        metadata: node.metadata || {},
        name: fragment.name,
        root: node,
        text: "",
      };
      const generatedNode = generateIRDocument(schema, request);
      res.push(generatedNode);
    }
  });
  // This is for read/writing with just fragments
  fragmentCompilerContext.forEachDocument((node) => {
    if (node.kind === "Fragment") {
      res.push(generateIRDocument(schema, node));
    }
  });
  const x = res[0];
  if (addHash) {
    x.hash = hash(JSON.stringify(x));
  }
  return x;
}

function uniqueFilter<T>(value: T, index: number, array: T[]) {
  return array.indexOf(value) === index;
}

export function transformSchema(schema: DocumentNode) {
  return createSchema(new Source(printGraphQLJS(schema)));
}
