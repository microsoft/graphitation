import {
  Kind,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  SelectionNode,
  SelectionSetNode,
} from "graphql";
import { getDirectiveValues } from "./values";
import {
  GraphQLSkipDirective,
  GraphQLIncludeDirective,
  GraphQLDeferDirective,
} from "./directives";

import { AccumulatorMap } from "./jsutils/AccumulatorMap";
import invariant from "invariant";
import { ExecutionContext } from "./executeWithoutSchema";
import { SchemaFragment } from "./types/schema";

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
  exeContext: ExecutionContext,
  runtimeTypeName: string,
): FieldsAndPatches {
  const { operation } = exeContext;
  const groupedFieldSet = new AccumulatorMap<string, FieldNode>();
  const patches: Array<PatchFields> = [];
  collectFieldsImpl(
    exeContext,
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
  exeContext: ExecutionContext,
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
        exeContext,
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
  exeContext: ExecutionContext,
  runtimeTypeName: string,
  selectionSet: SelectionSetNode,
  groupedFieldSet: AccumulatorMap<string, FieldNode>,
  patches: Array<PatchFields>,
  visitedFragmentNames: Set<string>,
): void {
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        if (!shouldIncludeNode(exeContext, selection)) {
          continue;
        }
        groupedFieldSet.add(getFieldEntryKey(selection), selection);
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (
          !shouldIncludeNode(exeContext, selection) ||
          !doesFragmentConditionMatch(
            selection,
            runtimeTypeName,
            exeContext.schemaTypes,
          )
        ) {
          continue;
        }

        const defer = getDeferValues(exeContext, selection);

        if (defer) {
          const patchFields = new AccumulatorMap<string, FieldNode>();
          collectFieldsImpl(
            exeContext,
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
            exeContext,
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

        if (!shouldIncludeNode(exeContext, selection)) {
          continue;
        }

        const defer = getDeferValues(exeContext, selection);
        if (visitedFragmentNames.has(fragName) && !defer) {
          continue;
        }

        const fragment = exeContext.fragments[fragName];
        if (
          fragment == null ||
          !doesFragmentConditionMatch(
            fragment,
            runtimeTypeName,
            exeContext.schemaTypes,
          )
        ) {
          continue;
        }

        if (!defer) {
          visitedFragmentNames.add(fragName);
        }

        if (defer) {
          const patchFields = new AccumulatorMap<string, FieldNode>();
          collectFieldsImpl(
            exeContext,
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
            exeContext,
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
  exeContext: ExecutionContext,
  node: SelectionNode,
): boolean {
  if (!node.directives?.length) {
    return true;
  }

  const skip = getDirectiveValues(exeContext, GraphQLSkipDirective, node);
  if (skip?.if === true) {
    return false;
  }

  const include = getDirectiveValues(exeContext, GraphQLIncludeDirective, node);
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
  // resolvers: Resolvers,
  schemaFragment: SchemaFragment,
): boolean {
  const typeConditionNode = fragment.typeCondition;
  if (!typeConditionNode) {
    return true;
  }

  const conditionalTypeName = typeConditionNode.name.value;

  if (conditionalTypeName === typeName) {
    return true;
  }
  if (schemaFragment.isAbstractType(conditionalTypeName)) {
    return schemaFragment.isSubType(conditionalTypeName, typeName);
  }
  return false;
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
  exeContext: ExecutionContext,
  node: FragmentSpreadNode | InlineFragmentNode,
): undefined | { label: string | undefined } {
  const defer = getDirectiveValues(exeContext, GraphQLDeferDirective, node);

  if (!defer) {
    return;
  }

  if (defer.if === false) {
    return;
  }

  invariant(
    exeContext.operation.operation !== "subscription",
    "`@defer` directive not supported on subscription operations. Disable `@defer` by setting the `if` argument to `false`.",
  );

  return {
    label: typeof defer.label === "string" ? defer.label : undefined,
  };
}
