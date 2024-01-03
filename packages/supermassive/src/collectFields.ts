import {
  Kind,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  SelectionNode,
  SelectionSetNode,
  OperationDefinitionNode,
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
import { ObjMap } from "./jsutils/ObjMap";
import { Maybe } from "./jsutils/Maybe";
import { FieldGroup } from "./buildFieldPlan";

export interface DeferUsage {
  label: string | undefined;
  parentDeferUsage: DeferUsage | undefined;
}

export interface StreamUsage {
  label: string | undefined;
  initialCount: number;
  fieldGroup: FieldGroup;
}

export interface FieldDetails {
  node: FieldNode;
  deferUsage: DeferUsage | undefined;
}

export type GroupedFieldSet = Map<string, FieldGroup>;

export interface PatchFields {
  label: string | undefined;
  groupedFieldSet: GroupedFieldSet;
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
): Map<string, ReadonlyArray<FieldDetails>> {
  const groupedFieldSet = new AccumulatorMap<string, FieldDetails>();
  const context: CollectFieldsContext = {
    schemaFragment: exeContext.schemaFragment,
    fragments: exeContext.fragments,
    variableValues: exeContext.variableValues,
    runtimeTypeName,
    operation: exeContext.operation,
    visitedFragmentNames: new Set(),
  };
  collectFieldsImpl(
    context,
    exeContext.operation.selectionSet,
    groupedFieldSet,
  );
  return groupedFieldSet;
}

interface CollectFieldsContext {
  schemaFragment: SchemaFragment;
  fragments: ObjMap<FragmentDefinitionNode>;
  variableValues: { [variable: string]: unknown };
  operation: OperationDefinitionNode;
  runtimeTypeName: string;
  visitedFragmentNames: Set<string>;
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
  schemaFragment: SchemaFragment,
  fragments: ObjMap<FragmentDefinitionNode>,
  variableValues: { [variable: string]: unknown },
  operation: OperationDefinitionNode,
  returnTypeName: string,
  fieldDetails: ReadonlyArray<FieldDetails>,
): Map<string, ReadonlyArray<FieldDetails>> {
  const context: CollectFieldsContext = {
    schemaFragment,
    fragments,
    variableValues,
    runtimeTypeName: returnTypeName,
    operation,
    visitedFragmentNames: new Set(),
  };
  const subGroupedFieldSet = new AccumulatorMap<string, FieldDetails>();

  for (const fieldDetail of fieldDetails) {
    const node = fieldDetail.node;
    if (node.selectionSet) {
      collectFieldsImpl(
        context,
        node.selectionSet,
        subGroupedFieldSet,
        fieldDetail.deferUsage,
      );
    }
  }

  return subGroupedFieldSet;
}

// eslint-disable-next-line max-params
function collectFieldsImpl(
  context: CollectFieldsContext,
  selectionSet: SelectionSetNode,
  groupedFieldSet: AccumulatorMap<string, FieldDetails>,
  parentDeferUsage?: DeferUsage,
  deferUsage?: DeferUsage,
): void {
  const {
    schemaFragment,
    fragments,
    variableValues,
    runtimeTypeName,
    operation,
    visitedFragmentNames,
  } = context;

  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case Kind.FIELD: {
        if (!shouldIncludeNode(schemaFragment, variableValues, selection)) {
          continue;
        }
        groupedFieldSet.add(getFieldEntryKey(selection), {
          node: selection,
          deferUsage: deferUsage ?? parentDeferUsage,
        });
        break;
      }
      case Kind.INLINE_FRAGMENT: {
        if (
          !shouldIncludeNode(schemaFragment, variableValues, selection) ||
          !doesFragmentConditionMatch(
            selection,
            runtimeTypeName,
            schemaFragment,
          )
        ) {
          continue;
        }

        const newDeferUsage = getDeferUsage(
          schemaFragment,
          operation,
          variableValues,
          selection,
          parentDeferUsage,
        );

        collectFieldsImpl(
          context,
          selection.selectionSet,
          groupedFieldSet,
          parentDeferUsage,
          newDeferUsage ?? deferUsage,
        );

        break;
      }
      case Kind.FRAGMENT_SPREAD: {
        const fragName = selection.name.value;

        const newDeferUsage = getDeferUsage(
          schemaFragment,
          operation,
          variableValues,
          selection,
          parentDeferUsage,
        );

        if (
          !newDeferUsage &&
          (visitedFragmentNames.has(fragName) ||
            !shouldIncludeNode(schemaFragment, variableValues, selection))
        ) {
          continue;
        }

        const fragment = fragments[fragName];
        if (
          fragment == null ||
          !doesFragmentConditionMatch(fragment, runtimeTypeName, schemaFragment)
        ) {
          continue;
        }
        if (!newDeferUsage) {
          visitedFragmentNames.add(fragName);
        }

        collectFieldsImpl(
          context,
          fragment.selectionSet,
          groupedFieldSet,
          parentDeferUsage,
          newDeferUsage ?? deferUsage,
        );
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
  schemaFragment: SchemaFragment,
  variableValues: Maybe<ObjMap<unknown>>,
  node: SelectionNode,
): boolean {
  if (!node.directives?.length) {
    return true;
  }

  const skip = getDirectiveValues(
    schemaFragment,
    GraphQLSkipDirective,
    node,
    variableValues,
  );
  if (skip?.if === true) {
    return false;
  }

  const include = getDirectiveValues(
    schemaFragment,
    GraphQLIncludeDirective,
    node,
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
function getDeferUsage(
  schemaFragment: SchemaFragment,
  operation: OperationDefinitionNode,
  variableValues: { [variable: string]: unknown },
  node: FragmentSpreadNode | InlineFragmentNode,
  parentDeferUsage: DeferUsage | undefined,
): DeferUsage | undefined {
  const defer = getDirectiveValues(
    schemaFragment,
    GraphQLDeferDirective,
    node,
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
    parentDeferUsage,
  };
}
