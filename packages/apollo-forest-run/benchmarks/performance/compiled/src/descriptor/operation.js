"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.describeOperation = describeOperation;
exports.applyDefaultValues = applyDefaultValues;
exports.createVariablesKey = createVariablesKey;
const graphql_1 = require("graphql");
const normalize_1 = require("../jsutils/normalize");
const defaultOperationTypes = {
    query: "Query",
    mutation: "Mutation",
    subscription: "Subscription",
};
const defaultRootNodeKeys = {
    query: "ROOT_QUERY",
    mutation: "ROOT_MUTATION",
    subscription: "ROOT_SUBSCRIPTION",
};
function describeOperation(env, documentDescriptor, resultTreeDescriptor, variables, variablesWithDefaults, variablesKey, rootTypeName, rootNodeKey) {
    var _a, _b;
    const { definition: { operation, variableDefinitions, directives }, } = documentDescriptor;
    const effectiveRootTypeName = rootTypeName !== null && rootTypeName !== void 0 ? rootTypeName : defaultOperationTypes[operation];
    const effectiveRootNodeKey = rootNodeKey !== null && rootNodeKey !== void 0 ? rootNodeKey : defaultRootNodeKeys[operation];
    if (!effectiveRootTypeName) {
        throw new Error(`Unexpected operation type: ${operation}`);
    }
    variablesWithDefaults !== null && variablesWithDefaults !== void 0 ? variablesWithDefaults : (variablesWithDefaults = applyDefaultValues(variables, variableDefinitions));
    return {
        ...documentDescriptor,
        ...resultTreeDescriptor,
        id: (_b = (_a = env.genId) === null || _a === void 0 ? void 0 : _a.call(env)) !== null && _b !== void 0 ? _b : 0,
        env,
        variables,
        variablesWithDefaults,
        rootType: effectiveRootTypeName,
        rootNodeKey: effectiveRootNodeKey,
        selections: new Map(),
        keyVariables: getKeyVars(documentDescriptor.definition),
        variablesKey: variablesKey !== null && variablesKey !== void 0 ? variablesKey : createVariablesKey(variableDefinitions, variablesWithDefaults),
        cache: Boolean(operation !== "mutation" ||
            (directives === null || directives === void 0 ? void 0 : directives.some((d) => d.name.value === "cache"))),
    };
}
function applyDefaultValues(variableValues, variableDefinitions) {
    if (!(variableDefinitions === null || variableDefinitions === void 0 ? void 0 : variableDefinitions.length)) {
        return variableValues;
    }
    // Note: ideally there should be either variableValue, or vd.defaultValue
    // but there are cases in existing projects where both are undefined 🤷
    // FIXME: throw proper error and fix on the consumer side instead
    let defaultValues = null;
    for (const variableDef of variableDefinitions) {
        const variableName = variableDef.variable.name.value;
        if (variableValues[variableName] !== undefined ||
            variableDef.defaultValue === undefined) {
            continue;
        }
        const defaultValue = (0, graphql_1.valueFromASTUntyped)(variableDef.defaultValue);
        if (defaultValue === undefined) {
            continue;
        }
        if (!defaultValues) {
            defaultValues = {};
        }
        defaultValues[variableName] = defaultValue;
    }
    return defaultValues
        ? { ...variableValues, ...defaultValues }
        : variableValues;
}
function getKeyVars(doc) {
    var _a, _b, _c;
    const directive = (_a = doc.directives) === null || _a === void 0 ? void 0 : _a.find((d) => d.name.value === "cache");
    const astValue = (_c = (_b = directive === null || directive === void 0 ? void 0 : directive.arguments) === null || _b === void 0 ? void 0 : _b.find((arg) => arg.name.value === "keyVars")) === null || _c === void 0 ? void 0 : _c.value;
    if (!astValue) {
        return null;
    }
    const value = (0, graphql_1.valueFromASTUntyped)(astValue);
    if (!Array.isArray(value) ||
        value.some((variable) => typeof variable !== "string")) {
        throw new Error('Could not extract keyVars. Expected directive format: @cache(keyVars=["var1", "var2"]), ' +
            `got ${JSON.stringify(value)} in place of keyVars`);
    }
    return value;
}
function createVariablesKey(defs, variablesWithDefaults) {
    // Note: string concatenation in V8 is fast and memory efficient due to string interning and windowing
    let key = "";
    if (defs === null || defs === void 0 ? void 0 : defs.length) {
        for (const variableDef of defs) {
            const variableName = variableDef.variable.name.value;
            const value = variablesWithDefaults[variableName];
            key += variableName + ":" + JSON.stringify((0, normalize_1.sortKeys)(value)) + ",";
        }
    }
    else {
        // ApolloCompat: apollo supports writes without variable definitions
        //   TODO: detect existing variables in resultTreeDescriptor
        key = JSON.stringify((0, normalize_1.sortKeys)(variablesWithDefaults));
    }
    return key;
}
