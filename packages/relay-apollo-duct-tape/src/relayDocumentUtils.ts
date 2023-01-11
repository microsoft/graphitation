import { transform as transformToIR } from "./vendor/relay-compiler/lib/core/RelayParser";
import CompilerContext from "./vendor/relay-compiler/lib/core/CompilerContext";
import { create as createSchema } from "./vendor/relay-compiler/lib/core/Schema";
import { transform } from "./vendor/relay-compiler/lib/core/IRTransformer";
import * as FlattenTransform from "./vendor/relay-compiler/lib/transforms/FlattenTransform";
import * as InlineFragmentsTransform from "./vendor/relay-compiler/lib/transforms/InlineFragmentsTransform";
import { generate as generateIRDocument } from "./vendor/relay-compiler/lib/codegen/RelayCodeGenerator";

import {
  Source,
  print as printGraphQLJS,
  getNamedType,
  getNullableType,
} from "graphql";
import hash from "@emotion/hash";

import type { DefinitionNode, DocumentNode } from "graphql";
import type { Schema } from "./vendor/relay-compiler/lib/core/Schema";
import type {
  ScalarField,
  Request,
  LinkedField,
} from "relay-compiler/lib/core/IR";

// TODO: Hash input document instead, which means memoization can skip
//       actually applying this transform.
export function transformDocument(
  schema: Schema,
  document: DocumentNode,
  addHash: boolean,
  typePolicies: any | undefined,
) {
  const nodes = transformToIR(
    schema,
    // TODO: Add test with multiple references to the same fragment
    // And is this still necessary if we already do it in Cache.transformDocument
    (document.definitions as DefinitionNode[]).filter(uniqueFilter),
  );
  let compilerContext = new CompilerContext(schema);
  for (const node of nodes) {
    compilerContext = compilerContext.add(node);
  }
  let operationCompilerContext = compilerContext.applyTransform(
    InlineFragmentsTransform.transform,
  );
  let fragmentCompilerContext = compilerContext.applyTransform(
    FlattenTransform.transformWithOptions({
      isForCodegen: true,
    } as any),
  );

  // const s = { parentType: undefined };
  // operationCompilerContext = transform(
  //   fragmentCompilerContext,
  //   {
  //     ScalarField: (
  //       fieldNode: ScalarField,
  //       state: { parentType: undefined | string },
  //     ) => {
  //       const typePolicy =
  //         typePolicies && state.parentType && typePolicies[state.parentType];
  //       const readerFn = typePolicy?.fields?.[fieldNode.name]?.read;
  //       if (readerFn) {
  //         return {
  //           kind: "RelayResolver",
  //           name: fieldNode.name,
  //           resolverModule: readerFn,
  //         };
  //       }
  //       return fieldNode;
  //     },
  //     LinkedField: (
  //       node: LinkedField,
  //       state: { parentType: undefined | string },
  //     ) => {
  //       state.parentType = schema.getNullableType(node.type).name;
  //       return node;
  //     },
  //   },
  //   () => s,
  // );

  const s1 = { parentType: undefined };
  fragmentCompilerContext = transform(
    fragmentCompilerContext,
    {
      ScalarField: (
        fieldNode: ScalarField,
        state: { parentType: undefined | string },
      ) => {
        const typePolicy =
          typePolicies && state.parentType && typePolicies[state.parentType];
        const readerFn = typePolicy?.fields?.[fieldNode.name]?.read;
        if (readerFn) {
          return {
            kind: "RelayResolver",
            name: fieldNode.name,
            resolverModule: readerFn,
          };
        }
        return fieldNode;
      },
      LinkedField: (
        node: LinkedField,
        state: { parentType: undefined | string },
      ) => {
        state.parentType = schema.getNullableType(node.type).name;
        return node;
      },
    },
    () => s1,
  );

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
  console.log(JSON.stringify(x, null, 2));
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
