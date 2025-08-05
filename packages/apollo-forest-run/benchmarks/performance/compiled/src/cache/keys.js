"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.identify = identify;
exports.objectKey = objectKey;
exports.keyArgs = keyArgs;
exports.keyFromConnectionDirective = keyFromConnectionDirective;
exports.fieldToStringKey = fieldToStringKey;
const assert_1 = require("../jsutils/assert");
const normalize_1 = require("../jsutils/normalize");
const descriptor_1 = require("./descriptor");
const Descriptor = __importStar(require("../descriptor/resolvedSelection"));
function identify(env, object) {
    var _a, _b;
    try {
        const value = (_a = object.__ref) !== null && _a !== void 0 ? _a : objectKey(env, object);
        return typeof value !== "string" ? undefined : value;
    }
    catch (e) {
        (_b = env.logger) === null || _b === void 0 ? void 0 : _b.warn(e);
        return undefined;
    }
}
function objectKey({ keyMap, dataIdFromObject, typePolicies }, object, selection, operation) {
    var _a;
    // ApolloCompat: this is necessary for compatibility with extract/restore methods
    //   (where object key is not inferable otherwise)
    const key = keyMap === null || keyMap === void 0 ? void 0 : keyMap.get(object);
    if (key !== undefined && key !== "ROOT_QUERY") {
        return key;
    }
    const typeName = object.__typename;
    if (!typeName || descriptor_1.ROOT_TYPES.includes(typeName)) {
        // ApolloCompat
        // TODO: pass proper Apollo-compatible context in the 2nd argument.
        //  For now passing empty objects to satisfy TMP unit tests
        // FIXME: should we return root node keys for default types?
        const key = dataIdFromObject === null || dataIdFromObject === void 0 ? void 0 : dataIdFromObject(object, {});
        return typeof key === "number" ? String(key) : key;
    }
    const typePolicy = typePolicies[typeName];
    if (typePolicy === null || typePolicy === void 0 ? void 0 : typePolicy.keyFields) {
        // TODO: Move typePolicy validation to creation time (for perf)
        const keyFields = typeof (typePolicy === null || typePolicy === void 0 ? void 0 : typePolicy.keyFields) === "function"
            ? typePolicy.keyFields(object, {
                readField,
                typename: typeName,
                fragmentMap: Object.fromEntries((_a = operation === null || operation === void 0 ? void 0 : operation.fragmentMap.entries()) !== null && _a !== void 0 ? _a : []),
            })
            : typePolicy === null || typePolicy === void 0 ? void 0 : typePolicy.keyFields;
        if (keyFields === false) {
            return false;
        }
        if (!Array.isArray(keyFields)) {
            throw new Error(`Only simple keyFields are supported`);
        }
        const idParts = {};
        for (const field of keyFields) {
            if (typeof field !== "string") {
                throw new Error(`Only simple keyFields are supported`);
            }
            const dataKey = resolveDataKey(field, selection);
            const fieldValue = object[dataKey];
            if (typeof fieldValue === "undefined") {
                throw new Error(`Missing field '${field}' while extracting keyFields from ${inspect(object)}`);
            }
            idParts[field] = fieldValue;
        }
        return `${typeName}:${inspect(idParts)}`;
    }
    if (dataIdFromObject) {
        // ApolloCompat
        // TODO: pass proper Apollo-compatible context in the 2nd argument.
        //  For now passing empty objects to satisfy TMP unit tests
        const id = dataIdFromObject(object, {});
        if (id != null) {
            return String(id);
        }
    }
    // FIXME: fieldMap is required for proper identification!
    // let idField = "id";
    // if (selections) {
    //   const fields = getFieldMapByType(selections, typeName);
    //   const idFieldInfo = fields.get("id" as any);
    //   if (idFieldInfo) {
    //     const [idAlias] = idFieldInfo.aliases.keys();
    //     idField = idAlias;
    //   }
    // }
    //
    if (typeName && object["id"] !== undefined) {
        return `${typeName}:${object["id"]}`;
    }
    if (typeName && object["_id"] !== undefined) {
        return `${typeName}:${object["_id"]}`;
    }
    return undefined;
}
function keyArgs(env, typeName, fieldName, args, directives, source) {
    var _a, _b;
    const fieldPolicy = (_b = (_a = env.typePolicies[typeName]) === null || _a === void 0 ? void 0 : _a.fields) === null || _b === void 0 ? void 0 : _b[fieldName];
    if (!fieldPolicy) {
        return (directives === null || directives === void 0 ? void 0 : directives.size)
            ? keyFromConnectionDirective(directives, args)
            : undefined;
    }
    if (typeof fieldPolicy === "function") {
        // TODO: this is read function
        return undefined;
    }
    // TODO: proper "merge: false"
    // if (fieldPolicy.merge === false) {
    //   return false;
    // }
    let keyArgs;
    if (typeof fieldPolicy.keyArgs === "function") {
        keyArgs = fieldPolicy.keyArgs(args ? Object.fromEntries(args.entries()) : {}, {
            typename: typeName,
            fieldName,
            field: null,
            variables: source === null || source === void 0 ? void 0 : source.variablesWithDefaults,
        });
    }
    else {
        keyArgs = fieldPolicy.keyArgs;
    }
    if (keyArgs === undefined &&
        typeof fieldPolicy.merge === "function" &&
        typeof fieldPolicy.read === "function") {
        // ApolloCompat: merge and read are responsible for taking care of args
        keyArgs = false;
    }
    return keyArgs === false
        ? EMPTY_ARRAY
        : keyArgs;
}
function keyFromConnectionDirective(directives, args) {
    const connectionDirective = directives.get("connection");
    if (!connectionDirective) {
        return undefined;
    }
    const key = connectionDirective.args.get("key");
    const filterKeys = connectionDirective.args.get("filter");
    if (Array.isArray(filterKeys) && filterKeys.length > 0) {
        const filteredArgs = filterKeys.reduce((acc, key) => {
            acc[key] = args === null || args === void 0 ? void 0 : args.get(key);
            return acc;
        }, {});
        return key + `(${inspect((0, normalize_1.sortKeys)(filteredArgs))})`;
    }
    (0, assert_1.assert)(typeof key === "string" || key === undefined);
    return key;
}
function readField(fieldName, from) {
    if (typeof fieldName === "object") {
        throw new Error("Not implemented in ForestRun");
    }
    if (from.__ref) {
        throw new Error("Not implemented in ForestRun");
    }
    return from[fieldName];
}
function resolveDataKey(canonicalFieldName, selection) {
    if (!selection) {
        return canonicalFieldName;
    }
    const idFieldInfo = selection.fields.get(canonicalFieldName);
    if (idFieldInfo && (idFieldInfo === null || idFieldInfo === void 0 ? void 0 : idFieldInfo.length) > 0) {
        return idFieldInfo[0].dataKey;
    }
    return canonicalFieldName;
}
function fieldToStringKey(fieldEntry) {
    var _a;
    const keyArgs = typeof fieldEntry === "object" ? fieldEntry.keyArgs : undefined;
    if (typeof fieldEntry === "string" || (keyArgs === null || keyArgs === void 0 ? void 0 : keyArgs.length) === 0) {
        return Descriptor.getFieldName(fieldEntry);
    }
    const fieldName = Descriptor.getFieldName(fieldEntry);
    const fieldArgs = Descriptor.getFieldArgs(fieldEntry);
    // TODO: handle keyArgs === "string" case (basically key)
    const fieldKeyArgs = keyArgs && fieldArgs
        ? resolveKeyArgumentValues(fieldArgs, keyArgs)
        : fieldArgs;
    const filtered = [...((_a = fieldKeyArgs === null || fieldKeyArgs === void 0 ? void 0 : fieldKeyArgs.entries()) !== null && _a !== void 0 ? _a : [])].filter(([name, _]) => name !== "__missing");
    const args = sortEntriesRecursively(filtered).map(([name, value]) => `"${name}":${JSON.stringify(value)}`);
    if (typeof keyArgs === "string") {
        return `${fieldName}:${keyArgs}`; // keyArgs is actually the key
    }
    return keyArgs ? `${fieldName}:{${args}}` : `${fieldName}({${args}})`;
}
function resolveKeyArgumentValues(args, keyArgsSpecifier) {
    if (typeof keyArgsSpecifier === "string") {
        return args;
    }
    if (keyArgsSpecifier.length === args.size &&
        keyArgsSpecifier.every((argName) => args.has(argName))) {
        return args;
    }
    const keyArgs = new Map();
    for (const argName of keyArgsSpecifier) {
        const argValue = args.get(argName);
        if (argValue !== undefined) {
            keyArgs.set(argName, argValue);
        }
    }
    return keyArgs;
}
function sortEntriesRecursively(entries) {
    return (0, normalize_1.sortKeys)(entries).sort((a, b) => a[0].localeCompare(b[0]));
}
const inspect = JSON.stringify.bind(JSON);
const EMPTY_ARRAY = Object.freeze([]);
