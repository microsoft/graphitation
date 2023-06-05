import { Kind } from "graphql";
import {
  FieldNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  SelectionNode,
  SelectionSetNode,
} from "./ast/TypedAST";
import type { ObjMap } from "./jsutils/ObjMap";
import { getDirectiveValues } from "./values";
import { GraphQLSkipDirective, GraphQLIncludeDirective } from "./directives";
import { typeNameFromAST } from "./utilities/typeNameFromAST";
import { isUnionResolverType, isInterfaceResolverType } from "./definition";

import { Resolvers } from "./types";

/**
 * Given a selectionSet, adds all of the fields in that selection to
 * the passed in map of fields, and returns it at the end.
 *
 * CollectFields requires the "runtime type" of an object. For a field which
 * returns an Interface or Union type, the "runtime type" will be the actual
 * Object type returned by that field.
 *
 * @internal
 */
export function collectFields(
  resolvers: Resolvers,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  runtimeTypeName: string,
  selectionSet: SelectionSetNode,
  fields: Map<string, Array<FieldNode>>,
  visitedFragmentNames: Set<string>,
): Map<string, Array<FieldNode>> {
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        if (!shouldIncludeNode(resolvers, variableValues, selection)) {
          continue;
        }
        const name = getFieldEntryKey(selection);
        const fieldList = fields.get(name);
        if (fieldList !== undefined) {
          fieldList.push(selection);
        } else {
          fields.set(name, [selection]);
        }
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (
          !shouldIncludeNode(resolvers, variableValues, selection) ||
          !doesFragmentConditionMatch(selection, runtimeTypeName, resolvers)
        ) {
          continue;
        }
        collectFields(
          resolvers,
          fragments,
          variableValues,
          runtimeTypeName,
          selection.selectionSet,
          fields,
          visitedFragmentNames,
        );
        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragName = selection.name.value;
        if (
          visitedFragmentNames.has(fragName) ||
          !shouldIncludeNode(resolvers, variableValues, selection)
        ) {
          continue;
        }
        visitedFragmentNames.add(fragName);
        const fragment = fragments[fragName];
        if (
          !fragment ||
          !doesFragmentConditionMatch(fragment, runtimeTypeName, resolvers)
        ) {
          continue;
        }
        collectFields(
          resolvers,
          fragments,
          variableValues,
          runtimeTypeName,
          fragment.selectionSet,
          fields,
          visitedFragmentNames,
        );
        break;
      }
    }
  }
  return fields;
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
