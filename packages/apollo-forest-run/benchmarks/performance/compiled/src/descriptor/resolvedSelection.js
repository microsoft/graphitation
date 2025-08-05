"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSelection = resolveSelection;
exports.resolvedSelectionsAreEqual = resolvedSelectionsAreEqual;
exports.resolveNormalizedField = resolveNormalizedField;
exports.getFieldName = getFieldName;
exports.getFieldArgs = getFieldArgs;
exports.resolveFieldDataKey = resolveFieldDataKey;
exports.fieldEntriesAreEqual = fieldEntriesAreEqual;
const graphql_1 = require("graphql");
const equality_1 = require("@wry/equality");
const assert_1 = require("../jsutils/assert");
const possibleSelection_1 = require("./possibleSelection");
const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_MAP = new Map();
/**
 * Returns selection descriptor for the provided typeName. Enriches possible selection for this type with metadata that
 * could be only resolved at runtime (using operation variables):
 *
 * - Normalizes fields and arguments
 * - Resolves directive arguments
 * - Applies skip/include directives
 */
function resolveSelection(operation, possibleSelections, typeName) {
    var _a, _b, _c, _d;
    let map = operation.selections.get(possibleSelections);
    if (!map) {
        map = new Map();
        operation.selections.set(possibleSelections, map);
    }
    let resolvedSelection = map.get(typeName);
    if (!resolvedSelection) {
        const selection = (_a = possibleSelections.get(typeName)) !== null && _a !== void 0 ? _a : possibleSelections.get(null);
        (0, assert_1.assert)(selection);
        const normalizedFields = ((_b = selection.fieldsToNormalize) === null || _b === void 0 ? void 0 : _b.length)
            ? normalizeFields(operation, selection.fieldsToNormalize, typeName)
            : undefined;
        const skippedFields = ((_c = selection.fieldsWithDirectives) === null || _c === void 0 ? void 0 : _c.length)
            ? new Set(selection.fieldsWithDirectives.filter((field) => !shouldInclude(field.__refs, operation.variablesWithDefaults)))
            : undefined;
        const skippedSpreads = ((_d = selection.spreadsWithDirectives) === null || _d === void 0 ? void 0 : _d.length)
            ? new Set([...selection.spreadsWithDirectives.values()].filter((spread) => !shouldInclude(spread.__refs, operation.variablesWithDefaults)))
            : undefined;
        const fieldQueue = (skippedFields === null || skippedFields === void 0 ? void 0 : skippedFields.size)
            ? selection.fieldQueue.filter((field) => !skippedFields.has(field))
            : selection.fieldQueue;
        resolvedSelection =
            normalizedFields ||
                (skippedFields === null || skippedFields === void 0 ? void 0 : skippedFields.size) ||
                (skippedSpreads === null || skippedSpreads === void 0 ? void 0 : skippedSpreads.size) ||
                fieldQueue !== selection.fieldQueue
                ? {
                    ...selection,
                    fieldQueue,
                    normalizedFields,
                    skippedFields,
                    skippedSpreads,
                }
                : selection;
        map.set(typeName, resolvedSelection);
    }
    return resolvedSelection;
}
function resolvedSelectionsAreEqual(a, b) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    if (a === b) {
        return true;
    }
    if (a.fields !== b.fields) {
        // Note: this will always return false for operations with different documents.
        //   E.g. "query A { foo }" and "query B { foo }" have the same selection, but will return `false` here.
        //   This is OK for our current purposes with current perf requirements.
        return false;
    }
    if (((_a = a.skippedFields) === null || _a === void 0 ? void 0 : _a.size) !== ((_b = b.skippedFields) === null || _b === void 0 ? void 0 : _b.size)) {
        return false;
    }
    (0, assert_1.assert)(((_c = a.normalizedFields) === null || _c === void 0 ? void 0 : _c.size) === ((_d = b.normalizedFields) === null || _d === void 0 ? void 0 : _d.size));
    const aNormalizedFields = (_f = (_e = a.normalizedFields) === null || _e === void 0 ? void 0 : _e.entries()) !== null && _f !== void 0 ? _f : EMPTY_ARRAY;
    for (const [alias, aNormalized] of aNormalizedFields) {
        const bNormalized = (_g = b.normalizedFields) === null || _g === void 0 ? void 0 : _g.get(alias);
        (0, assert_1.assert)(aNormalized && bNormalized);
        if (!fieldEntriesAreEqual(aNormalized, bNormalized)) {
            return false;
        }
    }
    for (const aSkipped of (_h = a.skippedFields) !== null && _h !== void 0 ? _h : EMPTY_ARRAY) {
        if (!((_j = b.skippedFields) === null || _j === void 0 ? void 0 : _j.has(aSkipped))) {
            return false;
        }
    }
    // FIXME: this is not enough, we must also check all child selections are equal. It requires some descriptor-level
    //   aggregation of all possible fields / directives with variables
    return true;
}
function resolveNormalizedField(selection, field) {
    var _a;
    if (!field.args) {
        return field.name;
    }
    const normalizedField = (_a = selection.normalizedFields) === null || _a === void 0 ? void 0 : _a.get(field);
    (0, assert_1.assert)(normalizedField);
    return normalizedField;
}
function getFieldName(fieldEntry) {
    return typeof fieldEntry === "string" ? fieldEntry : fieldEntry.name;
}
function getFieldArgs(fieldEntry) {
    return typeof fieldEntry === "string" ? undefined : fieldEntry.args;
}
function normalizeFields(operation, fields, typeName) {
    const normalizedFields = new Map();
    for (const field of fields) {
        normalizedFields.set(field, normalizeField(operation, field, typeName));
    }
    return normalizedFields;
}
function normalizeField(operation, field, typeName) {
    var _a, _b;
    const variables = operation.variablesWithDefaults;
    const args = resolveFieldArguments(field, variables);
    const directives = resolveDirectiveValues(field.__refs.flatMap((f) => { var _a; return (_a = f.node.directives) !== null && _a !== void 0 ? _a : EMPTY_ARRAY; }), variables);
    const canHaveKeyArgs = typeName !== null && (args || (directives === null || directives === void 0 ? void 0 : directives.has("connection")));
    const keyArgs = canHaveKeyArgs
        ? (_b = (_a = operation.env).keyArgs) === null || _b === void 0 ? void 0 : _b.call(_a, typeName, field.name, args, directives, operation)
        : undefined;
    return args || keyArgs
        ? {
            name: field.name,
            args: args !== null && args !== void 0 ? args : new Map(),
            keyArgs,
        }
        : field.name;
}
function resolveFieldArguments(field, variables) {
    return field.args ? resolveArgumentValues(field.args, variables) : undefined;
}
function resolveArgumentValues(argDefinitions, variables) {
    const argValues = new Map();
    for (const [name, value] of argDefinitions.entries()) {
        const resolvedValue = (0, graphql_1.valueFromASTUntyped)(value, variables);
        if (resolvedValue !== undefined) {
            argValues.set(name, resolvedValue);
        }
    }
    return argValues;
}
function resolveFieldDataKey(fieldMap, field, variables) {
    const fieldName = getFieldName(field);
    const fieldArgs = getFieldArgs(field);
    const fieldEntries = fieldMap.get(fieldName);
    if (!(fieldEntries === null || fieldEntries === void 0 ? void 0 : fieldEntries.length)) {
        return undefined;
    }
    if (fieldEntries.length === 1 && !fieldEntries[0].args && !fieldArgs) {
        return fieldEntries[0].dataKey;
    }
    for (const fieldInfo of fieldEntries) {
        const args = resolveFieldArguments(fieldInfo, variables);
        if (argumentsAreEqual(fieldArgs, args) &&
            shouldInclude(fieldInfo.__refs, variables)) {
            return fieldInfo.dataKey;
        }
    }
    return undefined;
}
function fieldEntriesAreEqual(a, b) {
    if (typeof a === "string" || typeof b === "string") {
        return a === b;
    }
    if (typeof a.keyArgs === "string" || typeof b.keyArgs === "string") {
        // Key comparison
        return a.keyArgs === b.keyArgs;
    }
    if ((a.keyArgs || b.keyArgs) && !(0, equality_1.equal)(a.keyArgs, b.keyArgs)) {
        return false;
    }
    return (getFieldName(a) === getFieldName(b) &&
        argumentsAreEqual(getFieldArgs(a), getFieldArgs(b), a.keyArgs));
}
function argumentsAreEqual(a, b, keyArgs) {
    if (a === b) {
        return true;
    }
    if (!a || !b) {
        return false;
    }
    if (!keyArgs && a.size !== b.size) {
        return false;
    }
    for (const name of keyArgs !== null && keyArgs !== void 0 ? keyArgs : a.keys()) {
        if (!(0, equality_1.equal)(a.get(name), b.get(name))) {
            return false;
        }
    }
    return true;
}
function resolveDirectiveValues(directives, variables) {
    return new Map(directives.map((directive) => {
        var _a;
        return [
            directive.name.value,
            {
                args: ((_a = directive.arguments) === null || _a === void 0 ? void 0 : _a.length)
                    ? resolveArgumentValues((0, possibleSelection_1.createArgumentDefs)(directive.arguments), variables)
                    : EMPTY_MAP,
            },
        ];
    }));
}
function shouldInclude(nodes, variables) {
    if (!(nodes === null || nodes === void 0 ? void 0 : nodes.length)) {
        return false;
    }
    return nodes.some((ref) => shouldIncludeImpl(ref.node, variables) &&
        ref.ancestors.every((spread) => shouldIncludeImpl(spread, variables)));
}
function shouldIncludeImpl({ directives }, variables) {
    if (!directives || !directives.length) {
        return true;
    }
    return getInclusionDirectives(directives).every(({ directive, ifArgument }) => {
        var _a;
        let evaledValue = false;
        if (ifArgument.value.kind === "Variable") {
            evaledValue =
                (_a = (variables &&
                    variables[ifArgument.value.name.value])) !== null && _a !== void 0 ? _a : false; // coercing nullish-value to false
        }
        else {
            evaledValue = ifArgument.value.value;
        }
        return directive.name.value === "skip" ? !evaledValue : evaledValue;
    });
}
function getInclusionDirectives(directives) {
    const result = [];
    if (directives && directives.length) {
        directives.forEach((directive) => {
            if (!isInclusionDirective(directive))
                return;
            const directiveArguments = directive.arguments;
            (0, assert_1.assert)(directiveArguments && directiveArguments.length === 1);
            const ifArgument = directiveArguments[0];
            (0, assert_1.assert)(ifArgument.name && ifArgument.name.value === "if");
            const ifValue = ifArgument.value;
            // means it has to be a variable value if this is a valid @skip or @include directive
            (0, assert_1.assert)(ifValue &&
                (ifValue.kind === "Variable" || ifValue.kind === "BooleanValue"));
            result.push({ directive, ifArgument });
        });
    }
    return result;
}
function isInclusionDirective({ name: { value } }) {
    return value === "skip" || value === "include";
}
