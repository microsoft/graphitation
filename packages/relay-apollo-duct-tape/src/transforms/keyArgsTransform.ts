import { Node, Argument } from "relay-compiler/lib/core/IR";
import type { TypeID, CompositeTypeID } from "relay-compiler/lib/core/Schema";

import { FieldPolicy, TypePolicies } from "@apollo/client";
import { KeySpecifier } from "@apollo/client/cache/inmemory/policies";
import CompilerContext from "../vendor/relay-compiler/lib/core/CompilerContext";
import * as IRTransformer from "../vendor/relay-compiler/lib/core/IRTransformer";

type KeyArgsTransformState = {
  parentTypeName: string | null;
  nextParentTypeName: string | null;
  fieldName: string | null;
  keyArgsFromDirective: KeySpecifier | null;
};

export function keyArgsTransform(
  typePolicies: TypePolicies,
): (context: CompilerContext) => CompilerContext {
  return function keyArgsTransformFn(context: CompilerContext) {
    return keyArgsTransformImpl(context, typePolicies);
  };
}

function keyArgsTransformImpl(
  context: CompilerContext,
  typePolicies: TypePolicies,
): CompilerContext {
  const state: KeyArgsTransformState = {
    parentTypeName: null,
    nextParentTypeName: null,
    fieldName: null,
    keyArgsFromDirective: null,
  };
  return IRTransformer.transform(
    context,
    {
      Fragment: setParentTypeStateFactory(),
      InlineFragment: setParentTypeStateFactory(),
      LinkedField: setParentTypeStateFactory(),
      Root: setParentTypeStateFactory(),
      SplitOperation: setParentTypeStateFactory(),
      Argument: visitArgumentFactory(typePolicies),
    },
    () => state,
  );
}

function setParentTypeStateFactory<A extends Node>() {
  return function setParentTypeStateFactoryFn(
    node: A,
    state: KeyArgsTransformState,
  ) {
    const type =
      node.kind === "LinkedField" ||
      node.kind === "Fragment" ||
      node.kind === "Root" ||
      node.kind === "SplitOperation"
        ? node.type
        : node.kind === "InlineFragment"
        ? node.typeCondition
        : null;
    if (node.kind === "LinkedField") {
      if (state.nextParentTypeName) {
        state.parentTypeName = state.nextParentTypeName;
      }
      state.nextParentTypeName = unwrap(type).name;
      state.fieldName = node.name;
      const keyArgDirective = node.directives.find((d) => d.name === "keyArgs");
      if (keyArgDirective) {
        state.keyArgsFromDirective =
          (keyArgDirective.args?.find((arg) => (arg.name = "args"))
            ?.value as any as KeySpecifier) || null;
      } else {
        state.keyArgsFromDirective = null;
      }
    } else {
      state.parentTypeName = type.name;
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return this.traverse(node, state);
  };
}

function visitArgumentFactory(typePolicies: TypePolicies) {
  return (node: Argument, state: KeyArgsTransformState) => {
    if (state.parentTypeName && state.fieldName) {
      const fieldPolicies =
        typePolicies[state.parentTypeName]?.fields?.[state.fieldName];

      if (fieldPolicies && (fieldPolicies as FieldPolicy).keyArgs) {
        const keyArgs =
          ((fieldPolicies as FieldPolicy).keyArgs as KeySpecifier) ||
          state.keyArgsFromDirective;

        if (Array.isArray(keyArgs) && keyArgs.includes(node.name)) {
          return node;
        } else if (!Array.isArray(keyArgs)) {
          return node;
        } else {
          return null;
        }
      }
    }
    return node;
  };
}

function unwrap(type: TypeID): CompositeTypeID {
  if (type.ofType) {
    return unwrap(type.ofType);
  }
  return type;
}
