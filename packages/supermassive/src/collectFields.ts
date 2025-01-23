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
} from "./schema/directives";

import { AccumulatorMap } from "./jsutils/AccumulatorMap";
import invariant from "invariant";
import { ExecutionContext } from "./executeWithoutSchema";
import { isAbstractType, isSubType } from "./schema/definition";
import { SchemaFragment } from "./types";

export interface CollectFieldsResult {
  groupedFieldSet: GroupedFieldSet;
  deferredFieldSets: ReadonlyArray<DeferUsage>;
}

export interface DeferUsage {
  label: string | undefined;
  groupedFieldSet: GroupedFieldSet;
}

export type FieldGroup = ReadonlyArray<FieldNode>;

export type GroupedFieldSet = ReadonlyMap<string, FieldGroup>;

export function collectFields(
  exeContext: ExecutionContext,
  returnTypeName: string,
  selectionSet: SelectionSetNode,
): CollectFieldsResult {
  const groupedFieldSet = new AccumulatorMap<string, FieldNode>();
  const visitedFragmentNames = new Set<string>();
  const deferredFieldSets = new Array<DeferUsage>();
  collectFieldsImpl(
    exeContext,
    returnTypeName,
    selectionSet,
    groupedFieldSet,
    deferredFieldSets,
    visitedFragmentNames,
  );
  return {
    groupedFieldSet,
    deferredFieldSets,
  };
}

function collectFieldsImpl(
  exeContext: ExecutionContext,
  returnTypeName: string,
  selectionSet: SelectionSetNode,
  groupedFieldSet: AccumulatorMap<string, FieldNode>,
  deferredFieldSets: Array<DeferUsage>,
  visitedFragmentNames: Set<string>,
): void {
  for (const selection of selectionSet.selections) {
    if (!shouldIncludeNode(exeContext, selection)) {
      continue;
    }
    switch (selection.kind) {
      case Kind.FIELD: {
        groupedFieldSet.add(getFieldEntryKey(selection), selection);
        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragmentName = selection.name.value;
        const fragment = exeContext.fragments[fragmentName];
        if (
          visitedFragmentNames.has(fragmentName) ||
          !doesFragmentConditionMatch(
            fragment,
            returnTypeName,
            exeContext.schemaFragment,
          )
        ) {
          continue;
        }
        visitedFragmentNames.add(fragmentName);
        const fragmentSelectionSet = fragment.selectionSet;
        const { groupedFieldSet: fragmentGroupedFieldSets } = collectFields(
          exeContext,
          returnTypeName,
          fragmentSelectionSet,
        );
        const deferUsage = getDeferValues(exeContext, selection);
        if (deferUsage) {
          const deferGroupedFieldSet = new AccumulatorMap<string, FieldNode>();
          for (const [responseKey, selections] of fragmentGroupedFieldSets) {
            for (const selection of selections) {
              deferGroupedFieldSet.add(responseKey, selection);
            }
          }
          deferredFieldSets.push({
            label: deferUsage.label,
            groupedFieldSet: deferGroupedFieldSet,
          });
        } else {
          for (const [responseKey, selections] of fragmentGroupedFieldSets) {
            for (const selection of selections) {
              groupedFieldSet.add(responseKey, selection);
            }
          }
        }
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (
          !doesFragmentConditionMatch(
            selection,
            returnTypeName,
            exeContext.schemaFragment,
          )
        ) {
          continue;
        }
        const fragmentSelectionSet = selection.selectionSet;
        const { groupedFieldSet: fragmentGroupedFieldSets } = collectFields(
          exeContext,
          returnTypeName,
          fragmentSelectionSet,
        );
        const deferUsage = getDeferValues(exeContext, selection);
        if (deferUsage) {
          const deferGroupedFieldSet = new AccumulatorMap<string, FieldNode>();
          for (const [responseKey, selections] of fragmentGroupedFieldSets) {
            for (const selection of selections) {
              deferGroupedFieldSet.add(responseKey, selection);
            }
          }
          deferredFieldSets.push({
            label: deferUsage.label,
            groupedFieldSet: deferGroupedFieldSet,
          });
        } else {
          for (const [responseKey, selections] of fragmentGroupedFieldSets) {
            for (const selection of selections) {
              groupedFieldSet.add(responseKey, selection);
            }
          }
        }
        break;
      }
    }
  }
}

export function collectSubfields(
  exeContext: ExecutionContext,
  returnTypeName: string,
  fieldGroup: FieldGroup,
): CollectFieldsResult {
  const groupedFieldSet = new AccumulatorMap<string, FieldNode>();
  const deferredFieldSets = new Array<DeferUsage>();
  for (const fieldNode of fieldGroup) {
    if (fieldNode.selectionSet) {
      const {
        groupedFieldSet: subGroupedFieldSet,
        deferredFieldSets: deferredSubGrouppedFieldSets,
      } = collectFields(exeContext, returnTypeName, fieldNode.selectionSet);
      deferredFieldSets.push(...deferredSubGrouppedFieldSets);
      for (const [responseKey, selections] of subGroupedFieldSet) {
        for (const selection of selections) {
          groupedFieldSet.add(responseKey, selection);
        }
      }
    }
  }
  return { groupedFieldSet, deferredFieldSets };
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
  { definitions }: SchemaFragment,
): boolean {
  const typeConditionNode = fragment.typeCondition;
  if (!typeConditionNode) {
    return true;
  }

  const conditionalTypeName = typeConditionNode.name.value;

  if (conditionalTypeName === typeName) {
    return true;
  }
  if (isAbstractType(definitions, conditionalTypeName)) {
    return isSubType(definitions, conditionalTypeName, typeName);
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
): { label: string | undefined } | undefined {
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
