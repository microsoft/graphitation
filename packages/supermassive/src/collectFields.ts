import { Kind } from "graphql";
import {
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  OperationDefinitionNode,
  SelectionNode,
  SelectionSetNode,
} from "@graphitation/supermassive-ast";
import type { ObjMap } from "./jsutils/ObjMap";
import { getDirectiveValues } from "./values";
import {
  GraphQLSkipDirective,
  GraphQLIncludeDirective,
  GraphQLDeferDirective,
} from "./directives";
import { typeNameFromAST } from "./utilities/typeNameFromAST";
import { isUnionResolverType, isInterfaceResolverType } from "./definition";

import { Resolvers } from "./types";

import { AccumulatorMap } from "./jsutils/AccumulatorMap";
import invariant from "invariant";

export type FieldGroup = ReadonlyArray<FieldNode>;

export type GroupedFieldSet = Map<string, FieldGroup>;

export interface PatchFields {
  label: string | undefined;
  groupedFieldSet: GroupedFieldSet;
}

export interface FieldsAndPatches {
  groupedFieldSet: GroupedFieldSet;
  patches: Array<PatchFields>;
}

/**
 * Given a selectionSet, collects all of the fields and returns them.
 *
 * CollectFields requires the "runtime type" of an object. For a field that
 * returns an Interface or Union type, the "runtime type" will be the actual
 * object type returned by that field.
 *
 * @internal
 */
export function collectFields(
  resolvers: Resolvers,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  runtimeTypeName: string,
  operation: OperationDefinitionNode,
): FieldsAndPatches {
  const groupedFieldSet = new AccumulatorMap<string, FieldNode>();
  const patches: Array<PatchFields> = [];
  collectFieldsImpl(
    resolvers,
    fragments,
    variableValues,
    operation,
    runtimeTypeName,
    operation.selectionSet,
    groupedFieldSet,
    patches,
    new Set(),
  );
  return { groupedFieldSet, patches };
}

/**
 * Given an array of field nodes, collects all of the subfields of the passed
 * in fields, and returns them at the end.
 *
 * CollectSubFields requires the "return type" of an object. For a field that
 * returns an Interface or Union type, the "return type" will be the actual
 * object type returned by that field.
 *
 * @internal
 */
// eslint-disable-next-line max-params
export function collectSubfields(
  resolvers: Resolvers,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  operation: OperationDefinitionNode,
  returnTypeName: string,
  fieldGroup: FieldGroup,
): FieldsAndPatches {
  const subGroupedFieldSet = new AccumulatorMap<string, FieldNode>();
  const visitedFragmentNames = new Set<string>();

  const subPatches: Array<PatchFields> = [];
  const subFieldsAndPatches = {
    groupedFieldSet: subGroupedFieldSet,
    patches: subPatches,
  };

  for (const node of fieldGroup) {
    if (node.selectionSet) {
      collectFieldsImpl(
        resolvers,
        fragments,
        variableValues,
        operation,
        returnTypeName,
        node.selectionSet,
        subGroupedFieldSet,
        subPatches,
        visitedFragmentNames,
      );
    }
  }
  return subFieldsAndPatches;
}

// eslint-disable-next-line max-params
function collectFieldsImpl(
  resolvers: Resolvers,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  operation: OperationDefinitionNode,
  runtimeTypeName: string,
  selectionSet: SelectionSetNode,
  groupedFieldSet: AccumulatorMap<string, FieldNode>,
  patches: Array<PatchFields>,
  visitedFragmentNames: Set<string>,
): void {
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        if (!shouldIncludeNode(resolvers, variableValues, selection)) {
          continue;
        }
        groupedFieldSet.add(getFieldEntryKey(selection), selection);
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (
          !shouldIncludeNode(resolvers, variableValues, selection) ||
          !doesFragmentConditionMatch(selection, runtimeTypeName, resolvers)
        ) {
          continue;
        }

        const defer = getDeferValues(
          resolvers,
          operation,
          variableValues,
          selection,
        );

        if (defer) {
          const patchFields = new AccumulatorMap<string, FieldNode>();
          collectFieldsImpl(
            resolvers,
            fragments,
            variableValues,
            operation,
            runtimeTypeName,
            selection.selectionSet,
            patchFields,
            patches,
            visitedFragmentNames,
          );
          patches.push({
            label: defer.label,
            groupedFieldSet: patchFields,
          });
        } else {
          collectFieldsImpl(
            resolvers,
            fragments,
            variableValues,
            operation,
            runtimeTypeName,
            selection.selectionSet,
            groupedFieldSet,
            patches,
            visitedFragmentNames,
          );
        }
        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragName = selection.name.value;

        if (!shouldIncludeNode(resolvers, variableValues, selection)) {
          continue;
        }

        const defer = getDeferValues(
          resolvers,
          operation,
          variableValues,
          selection,
        );
        if (visitedFragmentNames.has(fragName) && !defer) {
          continue;
        }

        const fragment = fragments[fragName];
        if (
          fragment == null ||
          !doesFragmentConditionMatch(fragment, runtimeTypeName, resolvers)
        ) {
          continue;
        }

        if (!defer) {
          visitedFragmentNames.add(fragName);
        }

        if (defer) {
          const patchFields = new AccumulatorMap<string, FieldNode>();
          collectFieldsImpl(
            resolvers,
            fragments,
            variableValues,
            operation,
            runtimeTypeName,
            fragment.selectionSet,
            patchFields,
            patches,
            visitedFragmentNames,
          );
          patches.push({
            label: defer.label,
            groupedFieldSet: patchFields,
          });
        } else {
          collectFieldsImpl(
            resolvers,
            fragments,
            variableValues,
            operation,
            runtimeTypeName,
            fragment.selectionSet,
            groupedFieldSet,
            patches,
            visitedFragmentNames,
          );
        }
        break;
      }
    }
  }
}

/**
 * Determines if a field should be included based on the @include and @skip
 * directives, where @skip has higher precedence than @include.
 */
function shouldIncludeNode(
  resolvers: Resolvers,
  variableValues: { [variable: string]: unknown },
  node: SelectionNode,
): boolean {
  if (!node.directives?.length) {
    return true;
  }

  const skip = getDirectiveValues(
    GraphQLSkipDirective,
    node as SelectionNode,
    resolvers,
    variableValues,
  );
  if (skip?.if === true) {
    return false;
  }

  const include = getDirectiveValues(
    GraphQLIncludeDirective,
    node as SelectionNode,
    resolvers,
    variableValues,
  );

  if (include?.if === false) {
    return false;
  }

  return true;
}

/**
 * Determines if a fragment is applicable to the given type.
 */
function doesFragmentConditionMatch(
  fragment: FragmentDefinitionNode | InlineFragmentNode,
  typeName: string,
  resolvers: Resolvers,
): boolean {
  const typeConditionNode = fragment.typeCondition;
  if (!typeConditionNode) {
    return true;
  }

  const conditionalType = typeNameFromAST(typeConditionNode);

  if (conditionalType === typeName) {
    return true;
  }

  const subTypes = getSubTypes(resolvers, new Set(), conditionalType);

  return subTypes.has(typeName);
}

function getSubTypes(
  resolvers: Resolvers,
  abstractTypes: Set<string>,
  conditionalType: string,
): Set<string> {
  const resolver = resolvers[conditionalType];
  if (isInterfaceResolverType(resolver)) {
    const result = resolver.__implementedBy.reduce(
      (acc: string[], item: string) => {
        if (!abstractTypes.has(item)) {
          const newTypes = new Set([...abstractTypes, item]);

          acc.push(...abstractTypes, ...getSubTypes(resolvers, newTypes, item));
        }
        return acc;
      },
      [],
    );

    return new Set([...result]);
  }

  if (isUnionResolverType(resolver)) {
    const result = resolver.__types.reduce((acc: string[], item: string) => {
      if (!abstractTypes.has(item)) {
        const newTypes = new Set([...abstractTypes, item]);

        acc.push(...abstractTypes, ...getSubTypes(resolvers, newTypes, item));
      }
      return acc;
    }, []);

    return new Set([...result]);
  }

  return abstractTypes;
}

/**
 * Implements the logic to compute the key of a given field's entry
 */
function getFieldEntryKey(node: FieldNode): string {
  return node.alias ? node.alias.value : node.name.value;
}

/**
 * Returns an object containing the `@defer` arguments if a field should be
 * deferred based on the experimental flag, defer directive present and
 * not disabled by the "if" argument.
 */
function getDeferValues(
  resolvers: Resolvers,
  operation: OperationDefinitionNode,
  variableValues: { [variable: string]: unknown },
  node: FragmentSpreadNode | InlineFragmentNode,
): undefined | { label: string | undefined } {
  const defer = getDirectiveValues(
    GraphQLDeferDirective,
    node,
    resolvers,
    variableValues,
  );

  if (!defer) {
    return;
  }

  if (defer.if === false) {
    return;
  }

  invariant(
    operation.operation !== "subscription",
    "`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.",
  );

  return {
    label: typeof defer.label === "string" ? defer.label : undefined,
  };
}
