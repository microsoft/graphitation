import { valueFromASTUntyped } from "graphql";
import type {
  ArgumentNode,
  DirectiveNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  SelectionSetNode,
  ValueNode,
  VariableNode,
} from "graphql";
import type {
  TypeName,
  FieldInfo,
  FieldMap,
  DocumentDescriptor,
  PossibleSelections,
  PossibleSelection,
  PossibleTypes,
  ResultTreeDescriptor,
  FragmentMap,
} from "./types";
import { accumulate, getOrCreate } from "../jsutils/map";
import { assert } from "../jsutils/assert";

export type Context = Readonly<{
  fragmentMap: FragmentMap;
  possibleTypes?: PossibleTypes;
  inferredPossibleTypes: PossibleTypes;
  fieldsWithArgs: FieldInfo[];
  mergeMemo: Map<PossibleSelection, Set<PossibleSelection>>;
  copyOnWrite: Set<PossibleSelection | FieldInfo>;
}>;

const EMPTY_ARRAY = Object.freeze([]);

export function describeResultTree(
  doc: DocumentDescriptor,
  possibleTypes?: { [abstractType: TypeName]: TypeName[] },
): ResultTreeDescriptor {
  const context: Context = {
    fragmentMap: doc.fragmentMap,
    possibleTypes,
    inferredPossibleTypes: {},
    fieldsWithArgs: [],
    mergeMemo: new Map(),
    copyOnWrite: new Set(),
  };

  return {
    possibleSelections: collectPossibleSelections(
      context,
      doc.definition.selectionSet,
    ),
    fieldsWithArgs: context.fieldsWithArgs,
  };
}

function collectPossibleSelections(
  context: Context,
  selectionSet: SelectionSetNode,
): PossibleSelections {
  const commonSelection = createEmptySelection();
  const possibleSelections: PossibleSelections = new Map([
    [null, commonSelection],
  ]);
  collectFields(context, possibleSelections, selectionSet);
  mergeSubSelections(context, possibleSelections);
  completeSelections(possibleSelections, 0);

  return possibleSelections;
}

/**
 * Shallowly collects all subfields of a given field group.
 *
 * A variation of https://spec.graphql.org/draft/#sec-Field-Collection
 *
 * Several key differences from spec:
 *
 * 1. Field nodes are grouped at two levels: first - by field name, then - by "response key" (spec groups by "response key" only).
 *    This makes it easier to compare selections across different operations.
 *
 * 2. There is no runtime type, so fields for all possible type combinations are collected (PossibleSelections).
 *
 * 3. Fields of matching abstract types are not merged into selections of concrete types.
 *    They are merged later via appendUntypedSelection and appendAbstractTypeSelections methods.
 *    This helps with memory and perf, because we can re-use full selections from abstract types when
 *    they don't overlap with selections of concrete type.
 */
export function collectSubFields(
  context: Context,
  field: FieldInfo,
): PossibleSelections | undefined {
  const usages = field.__refs;
  if (!usages?.[0].node.selectionSet?.selections.length) {
    return undefined;
  }
  const commonSelection = createEmptySelection();
  const possibleSelections: PossibleSelections = new Map([
    [null, commonSelection],
  ]);
  for (const fieldUsage of usages) {
    if (fieldUsage.node.selectionSet) {
      collectFields(
        context,
        possibleSelections,
        fieldUsage.node.selectionSet,
        fieldUsage.parentSpreads ? [...fieldUsage.parentSpreads] : [],
      );
    }
  }
  return possibleSelections;
}

function collectFields(
  context: Context,
  selectionsByType: PossibleSelections,
  selectionSet: SelectionSetNode,
  fragmentStack: (FragmentSpreadNode | InlineFragmentNode)[] = [],
  typeCondition: TypeName | null | undefined = null,
  fragmentAlias?: string,
) {
  let selection = getOrCreate(
    selectionsByType,
    typeCondition,
    createEmptySelection,
  );
  if (fragmentAlias) {
    selection = getOrCreate(
      (selection.experimentalAliasedFragments ||= new Map()),
      fragmentAlias,
      createEmptySelection,
    );
    selection.experimentalAlias = fragmentAlias;
  }
  const parentSpreads = [...fragmentStack];
  for (const node of selectionSet.selections) {
    if (shouldSkip(node)) {
      continue;
    }
    if (node.kind === "Field") {
      addFieldEntry(context, selection.fields, node, parentSpreads);
    } else if (node.kind === "InlineFragment") {
      fragmentStack.push(node);
      collectFields(
        context,
        selectionsByType,
        node.selectionSet,
        fragmentStack,
        getTypeName(node) ?? typeCondition, // inherit type for inline fragments without type condition, i.e. ... {}
        // getFragmentAlias(node) ?
      );
      inferPossibleType(context, typeCondition, getTypeName(node));
      fragmentStack.pop();
    } else if (node.kind === "FragmentSpread") {
      if (fragmentStack.includes(node)) {
        continue;
      }
      const fragment = context.fragmentMap.get(node.name.value);
      if (!fragment) {
        throw new Error(`No fragment named ${node.name.value}.`);
      }
      fragmentStack.push(node);
      collectFields(
        context,
        selectionsByType,
        fragment.selectionSet,
        fragmentStack,
        getTypeName(fragment),
        getFragmentAlias(node),
      );
      inferPossibleType(context, typeCondition, getTypeName(fragment));
      fragmentStack.pop();
    }
  }
}

/**
 * Recursively merges sub-selections of all fields. After completion `possibleSelections` contain all
 * possible combinations of selections for different type conditions mentioned in the operation.
 *
 * Final result could be used to easily iterate over received results without additional resolutions.
 * This is important for clients because they need to run diffs over the same set of operations over and over again.
 *
 * A variation of:
 * https://spec.graphql.org/draft/#sec-Value-Completion.Merging-Selection-Sets
 * https://spec.graphql.org/draft/#sec-Field-Selection-Merging.Explanatory-Text
 */
function mergeSubSelections(
  context: Context,
  possibleSelections: PossibleSelections,
) {
  const abstractTypes: TypeName[] = [];
  for (const [typeName, selection] of possibleSelections.entries()) {
    for (const fieldAliases of selection.fields.values()) {
      for (const fieldInfo of fieldAliases) {
        fieldInfo.selection = collectSubFields(context, fieldInfo);
        if (fieldInfo.selection) {
          mergeSubSelections(context, fieldInfo.selection);
        }
      }
    }
    if (typeName && isAbstractType(context, typeName)) {
      abstractTypes.push(typeName);
    }
  }

  const untypedSelection = possibleSelections.get(null);
  if (untypedSelection) {
    appendUntypedSelection(context, possibleSelections, untypedSelection);
  }
  if (abstractTypes.length) {
    appendAbstractTypeSelections(context, possibleSelections, abstractTypes);
  }
}

function appendUntypedSelection(
  context: Context,
  possibleSelections: PossibleSelections,
  untypedSelection: PossibleSelection,
) {
  if (!untypedSelection.fields.size) {
    return;
  }
  for (const [typeName, selection] of possibleSelections.entries()) {
    if (selection === untypedSelection || isAbstractType(context, typeName)) {
      continue;
    }
    possibleSelections.set(
      typeName,
      mergeSelectionsImpl(context, selection, untypedSelection),
    );
  }
}

function appendAbstractTypeSelections(
  context: Context,
  possibleSelections: PossibleSelections,
  abstractTypes: TypeName[],
) {
  const unmentionedImplementations: TypeName[] = [];
  const untypedSelection = possibleSelections.get(null);

  for (const abstractTypeName of abstractTypes) {
    const abstractTypeSelection = possibleSelections.get(abstractTypeName);

    if (!abstractTypeSelection) {
      continue;
    }
    const possibleTypes = context.possibleTypes
      ? collectConcreteTypes(context.possibleTypes, abstractTypeName)
      : EMPTY_ARRAY;

    for (const specificTypeName of possibleTypes) {
      const selection = possibleSelections.get(specificTypeName);
      if (selection) {
        mergeSelectionsImpl(context, selection, abstractTypeSelection);
      } else {
        unmentionedImplementations.push(specificTypeName);
      }
    }

    // For all implementations not mentioned in the original document - share the same selection
    //  (consisting of untyped fields + abstract fields)
    if (unmentionedImplementations.length) {
      const mergedSelection = untypedSelection
        ? mergeSelections(context, createEmptySelection(), [
            abstractTypeSelection,
            untypedSelection,
          ])
        : abstractTypeSelection;
      for (const typeName of unmentionedImplementations) {
        possibleSelections.set(typeName, mergedSelection);
      }
      unmentionedImplementations.length = 0;
    }
  }
}

function completeSelections(possibleSelections: PossibleSelections, depth = 0) {
  // This runs when all selections already contain all fields
  const next: PossibleSelections[] = [];
  for (const selection of possibleSelections.values()) {
    selection.depth = depth;
    for (const fieldAliases of selection.fields.values()) {
      selection.fieldQueue.push(...fieldAliases);
    }
    for (const fieldAliases of selection.fields.values()) {
      for (const fieldInfo of fieldAliases) {
        if (fieldInfo.args?.size) {
          selection.fieldsToNormalize ??= [];
          selection.fieldsToNormalize.push(fieldInfo);
        }
        if (fieldInfo.selection) {
          selection.fieldsWithSelections ??= [];
          selection.fieldsWithSelections.push(fieldInfo.name);

          next.push(fieldInfo.selection);
        }
        for (const ref of fieldInfo.__refs) {
          if (
            ref.node.directives?.length ||
            ref.parentSpreads.some((spread) => spread.directives?.length)
          ) {
            selection.fieldsWithDirectives ??= [];
            if (!selection.fieldsWithDirectives.includes(fieldInfo)) {
              selection.fieldsWithDirectives.push(fieldInfo);
            }
            if (!selection.fieldsToNormalize?.includes(fieldInfo)) {
              selection.fieldsToNormalize ??= [];
              selection.fieldsToNormalize.push(fieldInfo);
            }
          }
          const spread = findClosestFragmentSpread(ref.parentSpreads);
          const selectedIn = spread ? spread.name.value : true;
          if (!fieldInfo.selectedIn.includes(selectedIn)) {
            fieldInfo.selectedIn.push(selectedIn);
          }
        }
      }
    }
  }
  for (const selection of next) {
    completeSelections(selection, depth + 1);
  }
  return possibleSelections;
}

function inferPossibleType(
  context: Context,
  abstractType: TypeName | null | undefined,
  possibleType: TypeName | null | undefined,
) {
  if (
    !abstractType ||
    !possibleType ||
    abstractType === possibleType ||
    context.inferredPossibleTypes[abstractType]?.includes(possibleType)
  ) {
    return;
  }
  context.inferredPossibleTypes[abstractType] ??= [];
  context.inferredPossibleTypes[abstractType].push(possibleType);

  // Note: we cannot rely on inference for actual abstract type detection because it is possible to spread fragments
  //   of abstract types *into* concrete types (not just the other way around)
  // TODO: use inference to validate correctness of provided `possibleTypes` and throw on missing `possibleTypes`.
}

function collectConcreteTypes(
  possibleTypes: PossibleTypes,
  type: TypeName,
  acc: TypeName[] = [],
): TypeName[] {
  if (acc.includes(type)) {
    return acc;
  }
  if (!possibleTypes[type]) {
    acc.push(type);
    return acc;
  }
  const concreteTypes = possibleTypes[type] ?? [];
  for (const type of concreteTypes) {
    collectConcreteTypes(possibleTypes, type, acc);
  }
  return acc;
}

function mergeSelections(
  context: Context,
  target: PossibleSelection,
  selections: PossibleSelection[],
): PossibleSelection {
  for (const source of selections) {
    mergeSelectionsImpl(context, target, source);
  }
  return target;
}

function mergeSelectionsImpl(
  context: Context,
  target: PossibleSelection,
  source: PossibleSelection,
): PossibleSelection {
  if (target === source) {
    return target;
  }
  let memo = context.mergeMemo.get(target);
  if (!memo) {
    memo = new Set<PossibleSelection>();
    context.mergeMemo.set(target, memo);
  }
  const alreadyMerged = memo.has(source);
  if (alreadyMerged) {
    return target;
  }
  memo.add(source);

  // About copy on write:
  //   Target is mutated during merging (for perf and memory efficiency).
  //   Source _should not_ be affected by mutations. However, if we naively assign values from source to target
  //   they may eventually become target during a recursive traversal and still be mutated.
  //
  // To prevent this we can:
  //   a) always copy source: but those are deep nested structures, and copying is expensive
  //   b) keep track of which values actually came from the "source" originally and copy them shallowly only on write
  // Here we use copy-on-write approach.
  // In practice many fields have no overlap between typed / untyped selections, so in most cases we don't copy

  const mutableTarget = context.copyOnWrite.has(target)
    ? copySelection(context, target)
    : target;

  if (mutableTarget !== target) {
    context.mergeMemo.set(mutableTarget, new Set([source]));
  }

  for (const [fieldName, sourceAliases] of source.fields.entries()) {
    const targetAliases: FieldInfo[] = getOrCreate(
      mutableTarget.fields,
      fieldName,
      newEmptyList,
    );
    for (const sourceField of sourceAliases) {
      const index = targetAliases.findIndex(
        (typedField) => typedField.alias === sourceField.alias,
      );
      if (index === -1) {
        targetAliases.push(sourceField);
        context.copyOnWrite.add(sourceField);
        continue;
      }
      targetAliases[index] = mergeField(
        context,
        targetAliases[index],
        sourceField,
      );
    }
  }
  return mutableTarget;
}

function mergeField(
  context: Context,
  target: FieldInfo,
  source: FieldInfo,
): FieldInfo {
  assert(
    target.name === source.name &&
      target.dataKey === source.dataKey &&
      Boolean(target.selection) === Boolean(source.selection),
  );
  const mutableTarget = context.copyOnWrite.has(target)
    ? copyFieldInfo(context, target)
    : target;

  mutableTarget.__refs.push(...source.__refs);
  mutableTarget.selectedIn.push(...source.selectedIn);

  if (!source.selection) {
    assert(!mutableTarget.selection);
    return mutableTarget;
  }
  assert(mutableTarget.selection);

  const untypedSource = source.selection.get(null);
  if (untypedSource) {
    appendUntypedSelection(context, mutableTarget.selection, untypedSource);
  }
  for (const [typeName, selection] of source.selection) {
    if (selection === untypedSource) {
      continue;
    }
    const targetSelection = mutableTarget.selection.get(typeName);
    if (!targetSelection) {
      mutableTarget.selection.set(typeName, selection);
      context.copyOnWrite.add(selection);
      const untyped = mutableTarget.selection.get(null);
      if (untyped) {
        appendUntypedSelection(context, mutableTarget.selection, untyped);
      }
      continue;
    }
    mutableTarget.selection.set(
      typeName,
      mergeSelectionsImpl(context, targetSelection, selection),
    );
  }
  return mutableTarget;
}

function newEmptyList() {
  return [];
}

function isAbstractType(context: Context, typeName: string | undefined | null) {
  return Boolean(typeName && context.possibleTypes?.[typeName]);
}

function addFieldEntry(
  context: Context,
  fieldMap: FieldMap,
  node: FieldNode,
  parentSpreads: (FragmentSpreadNode | InlineFragmentNode)[],
): FieldInfo {
  const fieldAliases = fieldMap.get(node.name.value);
  let fieldGroup = fieldAliases?.find(
    (field) => field.alias === node.alias?.value,
  );
  if (!fieldGroup) {
    fieldGroup = createFieldGroup(node);
    if (fieldGroup.args) {
      context.fieldsWithArgs.push(fieldGroup);
    }
    accumulate(fieldMap, node.name.value, fieldGroup);
  }
  fieldGroup.__refs ||= [];
  fieldGroup.__refs.push({ node, parentSpreads });

  return fieldGroup;
}

export function createFieldGroup(node: FieldNode): FieldInfo {
  const field: FieldInfo = {
    name: node.name.value,
    dataKey: node.alias ? node.alias.value : node.name.value,
    selectedIn: [],
    __refs: [],
  };
  if (node.alias) {
    field.alias = node.alias.value;
  }
  if (node.arguments?.length) {
    field.args = createArgumentDefs(node.arguments);
  }
  return field;
}

export function createArgumentDefs(args: ReadonlyArray<ArgumentNode>) {
  return new Map(args.map((arg) => [arg.name.value, arg.value]));
}

function copyFieldInfo(context: Context, info: FieldInfo): FieldInfo {
  const copy: FieldInfo = {
    name: info.name,
    dataKey: info.dataKey,
    selectedIn: [...info.selectedIn],
    __refs: [...(info.__refs ?? [])],
  };
  if (info.alias) {
    copy.alias = info.alias;
  }
  if (info.args) {
    copy.args = info.args;
  }
  if (info.selection) {
    copy.selection = new Map(info.selection.entries());
    for (const selection of copy.selection.values()) {
      context.copyOnWrite.add(selection);
    }
  }
  if (copy.args) {
    context.fieldsWithArgs.push(copy);
  }
  return copy;
}

function copySelection(
  context: Context,
  selection: PossibleSelection,
): PossibleSelection {
  const copy: PossibleSelection = {
    fields: new Map(),
    fieldQueue: [],
    experimentalAlias: selection.experimentalAlias,
    depth: selection.depth,
  };
  for (const [field, aliases] of selection.fields.entries()) {
    copy.fields.set(field, [...aliases]);
    for (const alias of aliases) {
      context.copyOnWrite.add(alias);
    }
  }
  if (selection.experimentalAliasedFragments) {
    copy.experimentalAliasedFragments = new Map(
      selection.experimentalAliasedFragments.entries(),
    );
    for (const subSelection of selection.experimentalAliasedFragments.values()) {
      context.copyOnWrite.add(subSelection);
    }
  }
  if (selection.fragmentSpreads) {
    copy.fragmentSpreads = [...selection.fragmentSpreads];
  }
  return copy;
}

function createEmptySelection(): PossibleSelection {
  return { fields: new Map(), fieldQueue: [], depth: -1 };
}

function getFragmentAlias(node: FragmentSpreadNode): string | undefined {
  const alias = findDirective(node, "alias");
  const aliasAs = findArgument(alias, "as");
  return aliasAs?.value?.kind === "StringValue"
    ? aliasAs.value.value
    : undefined;
}

function shouldSkip(node: NodeWithDirectives): boolean {
  const skipDirective = findDirective(node, "skip");
  const includeDirective = findDirective(node, "include");
  if (!skipDirective && !includeDirective) {
    return false;
  }
  const skipIf = findArgument(skipDirective, "if");
  const includeIf = findArgument(includeDirective, "if");
  if (isVariableNode(skipIf?.value) || isVariableNode(includeIf?.value)) {
    return false;
  }
  const skip = Boolean(
    skipIf ? valueFromASTUntyped(skipIf.value) : skipDirective,
  );
  const include = Boolean(
    includeIf ? valueFromASTUntyped(includeIf.value) : !includeDirective,
  );
  return skip || !include;
}

type NodeWithDirectives = { directives?: ReadonlyArray<DirectiveNode> };

function findDirective(
  node: NodeWithDirectives,
  name: string,
): DirectiveNode | undefined {
  return node.directives?.find((directive) => directive.name.value === name);
}

function findArgument(
  node: DirectiveNode | FieldNode | undefined,
  name: string,
): ArgumentNode | undefined {
  return node?.arguments?.find((arg) => arg.name.value === name);
}

function isVariableNode(value: ValueNode | undefined): value is VariableNode {
  return value?.kind === "Variable";
}

function findClosestFragmentSpread(
  parentSpreads: (FragmentSpreadNode | InlineFragmentNode)[],
): FragmentSpreadNode | undefined {
  for (let i = parentSpreads.length - 1; i >= 0; i--) {
    const spread = parentSpreads[i];
    if (spread.kind === "FragmentSpread") {
      return spread;
    }
  }
  return undefined;
}

function getTypeName(
  fragment: FragmentDefinitionNode | InlineFragmentNode,
): TypeName | undefined {
  return fragment.typeCondition
    ? (fragment.typeCondition.name.value as TypeName)
    : undefined;
}
