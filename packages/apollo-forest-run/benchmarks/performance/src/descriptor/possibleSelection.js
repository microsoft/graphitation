"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeResultTree = describeResultTree;
exports.collectSubFields = collectSubFields;
exports.createFieldGroup = createFieldGroup;
exports.createArgumentDefs = createArgumentDefs;
const graphql_1 = require("graphql");
const map_1 = require("../jsutils/map");
const assert_1 = require("../jsutils/assert");
const EMPTY_ARRAY = Object.freeze([]);
const OPERATION_WATCH_BOUNDARY = "";
const DEFAULT_WATCH_BOUNDARIES = Object.freeze([
    OPERATION_WATCH_BOUNDARY,
]);
function describeResultTree(doc, possibleTypes) {
    const context = {
        fragmentMap: doc.fragmentMap,
        possibleTypes,
        inferredPossibleTypes: {},
        fieldsWithArgs: [],
        mergeMemo: new Map(),
        copyOnWrite: new Set(),
    };
    return {
        possibleSelections: collectPossibleSelections(context, doc.definition.selectionSet),
        fieldsWithArgs: context.fieldsWithArgs,
    };
}
function collectPossibleSelections(context, selectionSet) {
    const commonSelection = createEmptySelection();
    const possibleSelections = new Map([
        [null, commonSelection],
    ]);
    collectFields(context, possibleSelections, selectionSet);
    mergeSubSelections(context, possibleSelections);
    completeSelections(context, possibleSelections, 0);
    return possibleSelections;
}
/**
 * Shallowly collects all subfields of a given field group.
 *
 * A variation of https://spec.graphql.org/October2021/#sec-Field-Collection
 *
 * Several key differences from the spec:
 *
 * 1. Field nodes are grouped at two levels: first - by field name, then - by "response key" (spec groups by "response key" only).
 *    This makes it easier to compare selections across different operations.
 *
 * 2. Runtime type is not known at this stage, so fields for all possible type combinations are collected (PossibleSelections).
 *
 * 3. Fields of matching abstract types are not merged into selections of concrete types.
 *    They are merged later via appendUntypedSelection and appendAbstractTypeSelections methods.
 *    This helps with memory and perf, because we can re-use full selections from abstract types when
 *    they don't overlap with selections of concrete type.
 */
function collectSubFields(context, field) {
    const usages = field.__refs;
    if (!usages?.[0].node.selectionSet?.selections.length) {
        return undefined;
    }
    const commonSelection = createEmptySelection();
    const possibleSelections = new Map([
        [null, commonSelection],
    ]);
    for (const { node, ancestors } of usages) {
        if (node.selectionSet) {
            // Note: mutating `ancestors` here and passing to `collectFields` without cloning for effiecency.
            //   Under the hood collectFields treats it as a stack and mutates, but since it is a stack - it is restored by the end of the call.
            const len = ancestors.length;
            const last = ancestors[len - 1];
            ancestors.push(node);
            collectFields(context, possibleSelections, node.selectionSet, ancestors);
            ancestors.pop();
            (0, assert_1.assert)(ancestors.length === len && ancestors[len - 1] === last);
        }
    }
    return possibleSelections;
}
function collectFields(context, selectionsByType, selectionSet, ancestorStack = [], typeCondition = null, fragmentAlias) {
    let selection = (0, map_1.getOrCreate)(selectionsByType, typeCondition, createEmptySelection);
    if (fragmentAlias) {
        selection = (0, map_1.getOrCreate)((selection.experimentalAliasedFragments || (selection.experimentalAliasedFragments = new Map())), fragmentAlias, createEmptySelection);
        selection.experimentalAlias = fragmentAlias;
    }
    const ancestors = [...ancestorStack];
    for (const node of selectionSet.selections) {
        if (shouldSkip(node)) {
            continue;
        }
        if (node.kind === "Field") {
            addFieldEntry(context, selection.fields, node, ancestors);
        }
        else if (node.kind === "InlineFragment") {
            inferPossibleType(context, typeCondition, getTypeName(node));
            ancestorStack.push(node);
            collectFields(context, selectionsByType, node.selectionSet, ancestorStack, getTypeName(node) ?? typeCondition);
            ancestorStack.pop();
        }
        else if (node.kind === "FragmentSpread") {
            // Note: currently if selection contains multiple spreads of the same fragment, this fragment will be visited multiple times (unfortunately).
            // Example:
            //   { ... FooBar @include(if: $foo), ...FooBar @include(if: $bar) }
            // This is needed to capture all possible "paths" to fields inside the fragment to account for @include / @skip / @defer on different parent spreads.
            // It is innefficient but unavoidable today.
            // TODO: rework this logic by properly capturing and aggregating directives in this function vs. in `completeSelection` and don't visit the same fragment multiple times.
            // Skipping the exact same spread (case of recursive fragments), but not fragment:
            if (ancestorStack.includes(node)) {
                continue;
            }
            const fragment = context.fragmentMap.get(node.name.value);
            if (!fragment) {
                throw new Error(`No fragment named ${node.name.value}.`);
            }
            addSpreadEntry(context, selectionsByType, fragment, node, ancestors);
            inferPossibleType(context, typeCondition, getTypeName(fragment));
            ancestorStack.push(node);
            collectFields(context, selectionsByType, fragment.selectionSet, ancestorStack, getTypeName(fragment), getFragmentAlias(node));
            ancestorStack.pop();
        }
        else {
            (0, assert_1.assertNever)(node);
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
function mergeSubSelections(context, possibleSelections) {
    const abstractTypes = [];
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
function appendUntypedSelection(context, possibleSelections, untypedSelection) {
    if (!untypedSelection.fields.size) {
        return;
    }
    for (const [typeName, selection] of possibleSelections.entries()) {
        if (selection === untypedSelection || isAbstractType(context, typeName)) {
            continue;
        }
        possibleSelections.set(typeName, mergeSelectionsImpl(context, selection, untypedSelection));
    }
}
function appendAbstractTypeSelections(context, possibleSelections, abstractTypes) {
    const unmentionedImplementations = [];
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
            }
            else {
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
function completeSelections(context, possibleSelections, depth = 0) {
    // This runs when all selections already contain all fields
    const next = [];
    for (const selection of possibleSelections.values()) {
        if (selection.depth !== -1) {
            // Already completed this selection, do not revisit: it is possible when the same interface selection is re-used for multiple implementations
            continue;
        }
        selection.depth = depth;
        for (const fieldAliases of selection.fields.values()) {
            selection.fieldQueue.push(...fieldAliases);
        }
        for (const fieldAliases of selection.fields.values()) {
            for (const fieldInfo of fieldAliases) {
                if (fieldInfo.args?.size) {
                    selection.fieldsToNormalize ?? (selection.fieldsToNormalize = []);
                    selection.fieldsToNormalize.push(fieldInfo);
                }
                if (fieldInfo.selection) {
                    selection.fieldsWithSelections ?? (selection.fieldsWithSelections = []);
                    selection.fieldsWithSelections.push(fieldInfo.name);
                    next.push(fieldInfo.selection);
                }
                for (const { node, ancestors } of fieldInfo.__refs) {
                    if (node.directives?.length ||
                        ancestors.some((ancestor) => ancestor.directives?.length)) {
                        selection.fieldsWithDirectives ?? (selection.fieldsWithDirectives = []);
                        if (!selection.fieldsWithDirectives.includes(fieldInfo)) {
                            selection.fieldsWithDirectives.push(fieldInfo);
                        }
                        if (!selection.fieldsToNormalize?.includes(fieldInfo)) {
                            selection.fieldsToNormalize ?? (selection.fieldsToNormalize = []);
                            selection.fieldsToNormalize.push(fieldInfo);
                        }
                    }
                    addWatchBoundary(fieldInfo, findClosestWatchBoundary(ancestors));
                }
            }
        }
        for (const spreadAliases of selection.spreads?.values() ?? EMPTY_ARRAY) {
            for (const spreadInfo of spreadAliases) {
                for (const { node, ancestors } of spreadInfo.__refs) {
                    if (node.directives?.length ||
                        ancestors.some((ancestor) => ancestor.directives?.length)) {
                        selection.spreadsWithDirectives ?? (selection.spreadsWithDirectives = []);
                        if (!selection.spreadsWithDirectives.includes(spreadInfo)) {
                            selection.spreadsWithDirectives.push(spreadInfo);
                        }
                    }
                    addWatchBoundary(spreadInfo, findClosestWatchBoundary(ancestors));
                }
            }
        }
    }
    for (const selection of next) {
        completeSelections(context, selection, depth + 1);
    }
    return possibleSelections;
}
function inferPossibleType(context, abstractType, possibleType) {
    var _a;
    if (!abstractType ||
        !possibleType ||
        abstractType === possibleType ||
        context.inferredPossibleTypes[abstractType]?.includes(possibleType)) {
        return;
    }
    (_a = context.inferredPossibleTypes)[abstractType] ?? (_a[abstractType] = []);
    context.inferredPossibleTypes[abstractType].push(possibleType);
    // Note: we cannot rely on inference for actual abstract type detection because it is possible to spread fragments
    //   of abstract types *into* concrete types (not just the other way around)
    // TODO: use inference to validate correctness of provided `possibleTypes` and throw on missing `possibleTypes`.
}
function collectConcreteTypes(possibleTypes, type, acc = []) {
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
function mergeSelections(context, target, selections) {
    for (const source of selections) {
        mergeSelectionsImpl(context, target, source);
    }
    return target;
}
function mergeSelectionsImpl(context, target, source) {
    if (target === source) {
        return target;
    }
    let memo = context.mergeMemo.get(target);
    if (!memo) {
        memo = new Set();
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
        const targetAliases = (0, map_1.getOrCreate)(mutableTarget.fields, fieldName, newEmptyList);
        for (const sourceField of sourceAliases) {
            const index = targetAliases.findIndex((typedField) => typedField.alias === sourceField.alias);
            if (index === -1) {
                targetAliases.push(sourceField);
                context.copyOnWrite.add(sourceField);
                continue;
            }
            targetAliases[index] = mergeField(context, targetAliases[index], sourceField);
        }
    }
    if (source.spreads?.size) {
        mutableTarget.spreads ?? (mutableTarget.spreads = new Map());
        for (const [name, spreadAliases] of source.spreads.entries()) {
            const targetAliases = (0, map_1.getOrCreate)(mutableTarget.spreads, name, newEmptyList);
            for (const sourceSpread of spreadAliases) {
                const index = targetAliases.findIndex((spread) => spread.alias === sourceSpread.alias);
                if (index === -1) {
                    targetAliases.push(sourceSpread);
                    context.copyOnWrite.add(sourceSpread);
                    continue;
                }
                targetAliases[index] = mergeSpread(context, targetAliases[index], sourceSpread);
            }
        }
    }
    return mutableTarget;
}
function mergeField(context, target, source) {
    (0, assert_1.assert)(target.name === source.name &&
        target.dataKey === source.dataKey &&
        Boolean(target.selection) === Boolean(source.selection));
    const mutableTarget = context.copyOnWrite.has(target)
        ? copyFieldInfo(context, target)
        : target;
    for (const boundary of source.watchBoundaries) {
        addWatchBoundary(mutableTarget, boundary);
    }
    mutableTarget.__refs.push(...source.__refs);
    if (!source.selection) {
        (0, assert_1.assert)(!mutableTarget.selection);
        return mutableTarget;
    }
    (0, assert_1.assert)(mutableTarget.selection);
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
        mutableTarget.selection.set(typeName, mergeSelectionsImpl(context, targetSelection, selection));
    }
    return mutableTarget;
}
function mergeSpread(context, target, source) {
    (0, assert_1.assert)(target.name === source.name && target.alias === source.alias);
    const mutableTarget = context.copyOnWrite.has(target)
        ? copySpreadInfo(context, target)
        : target;
    mutableTarget.__refs.push(...source.__refs);
    return mutableTarget;
}
function newEmptyList() {
    return [];
}
function isAbstractType(context, typeName) {
    return Boolean(typeName && context.possibleTypes?.[typeName]);
}
function addFieldEntry(context, fieldMap, node, ancestors) {
    const fieldAliases = fieldMap.get(node.name.value);
    let fieldGroup = fieldAliases?.find((field) => field.alias === node.alias?.value);
    if (!fieldGroup) {
        fieldGroup = createFieldGroup(node);
        if (fieldGroup.args) {
            context.fieldsWithArgs.push(fieldGroup);
        }
        (0, map_1.accumulate)(fieldMap, node.name.value, fieldGroup);
    }
    fieldGroup.__refs || (fieldGroup.__refs = []);
    fieldGroup.__refs.push({ node, ancestors });
    return fieldGroup;
}
function createFieldGroup(node) {
    const field = {
        name: node.name.value,
        dataKey: node.alias ? node.alias.value : node.name.value,
        watchBoundaries: EMPTY_ARRAY, // There are two many fields to create a separate array for each, use `addWatchBoundary` for proper management
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
function addWatchBoundary(container, boundary) {
    if (container.watchBoundaries === EMPTY_ARRAY) {
        container.watchBoundaries =
            boundary === OPERATION_WATCH_BOUNDARY
                ? DEFAULT_WATCH_BOUNDARIES
                : [boundary];
        return;
    }
    if (container.watchBoundaries === DEFAULT_WATCH_BOUNDARIES) {
        if (boundary === OPERATION_WATCH_BOUNDARY) {
            return;
        }
        container.watchBoundaries = [...DEFAULT_WATCH_BOUNDARIES, boundary];
        return;
    }
    if (!container.watchBoundaries.includes(boundary)) {
        container.watchBoundaries.push(boundary);
    }
}
function addSpreadEntry(context, selectionsByType, fragment, node, ancestors) {
    const selection = (0, map_1.getOrCreate)(selectionsByType, fragment.typeCondition.name.value, createEmptySelection);
    if (!selection.spreads) {
        selection.spreads = new Map();
    }
    const spreadAliases = selection.spreads.get(node.name.value);
    const alias = getFragmentAlias(node);
    let spreadGroup = spreadAliases?.find((spread) => spread.alias === alias);
    if (!spreadGroup) {
        spreadGroup = {
            name: node.name.value,
            alias,
            watchBoundaries: EMPTY_ARRAY, // use `addWatchBoundary` to manage it
            __refs: [],
        };
        (0, map_1.accumulate)(selection.spreads, node.name.value, spreadGroup);
    }
    spreadGroup.__refs || (spreadGroup.__refs = []);
    spreadGroup.__refs.push({ node, ancestors });
    return spreadGroup;
}
function createArgumentDefs(args) {
    return new Map(args.map((arg) => [arg.name.value, arg.value]));
}
function copyFieldInfo(context, info) {
    const copy = {
        name: info.name,
        dataKey: info.dataKey,
        watchBoundaries: info.watchBoundaries === EMPTY_ARRAY ||
            info.watchBoundaries === DEFAULT_WATCH_BOUNDARIES
            ? info.watchBoundaries
            : [...info.watchBoundaries],
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
function copySpreadInfo(context, info) {
    return {
        name: info.name,
        alias: info.alias,
        watchBoundaries: info.watchBoundaries === EMPTY_ARRAY ||
            info.watchBoundaries === DEFAULT_WATCH_BOUNDARIES
            ? info.watchBoundaries
            : [...info.watchBoundaries],
        __refs: [...(info.__refs ?? [])],
    };
}
function copySelection(context, selection) {
    const copy = {
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
        copy.experimentalAliasedFragments = new Map(selection.experimentalAliasedFragments.entries());
        for (const subSelection of selection.experimentalAliasedFragments.values()) {
            context.copyOnWrite.add(subSelection);
        }
    }
    if (selection.spreads) {
        copy.spreads = new Map();
        for (const [name, aliases] of selection.spreads.entries()) {
            copy.spreads.set(name, [...aliases]);
            for (const alias of aliases) {
                context.copyOnWrite.add(alias);
            }
        }
    }
    return copy;
}
function createEmptySelection() {
    return { fields: new Map(), fieldQueue: [], depth: -1 };
}
function getFragmentAlias(node) {
    const alias = findDirective(node, "alias");
    const aliasAs = findArgument(alias, "as");
    return aliasAs?.value?.kind === "StringValue"
        ? aliasAs.value.value
        : undefined;
}
function shouldSkip(node) {
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
    const skip = Boolean(skipIf ? (0, graphql_1.valueFromASTUntyped)(skipIf.value) : skipDirective);
    const include = Boolean(includeIf ? (0, graphql_1.valueFromASTUntyped)(includeIf.value) : !includeDirective);
    return skip || !include;
}
function findDirective(node, name) {
    return node.directives?.find((directive) => directive.name.value === name);
}
function findArgument(node, name) {
    return node?.arguments?.find((arg) => arg.name.value === name);
}
function isVariableNode(value) {
    return value?.kind === "Variable";
}
function findClosestWatchBoundary(ancestors) {
    for (let i = ancestors.length - 1; i >= 0; i--) {
        const node = ancestors[i];
        // ApolloCompat:
        // In Apollo 3.x watch boundary is marked by @nonreactive directive
        // Note:
        //   There is additional complication - custom variants: @nonreactive(if: $variable) and @mask(if: $variable)
        //   Variables are handled at runtime when bubbling to closest boundary
        if (node.kind === "FragmentSpread" && isPossibleWatchBoundary(node)) {
            return node.name.value;
        }
    }
    return OPERATION_WATCH_BOUNDARY;
}
function getTypeName(fragment) {
    return fragment.typeCondition
        ? fragment.typeCondition.name.value
        : undefined;
}
const isPossibleWatchBoundary = (node) => node.directives?.some((d) => d.name.value === "nonreactive") ?? false;
