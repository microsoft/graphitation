"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCacheEnvironment = createCacheEnvironment;
const keys_1 = require("./keys");
const policies_1 = require("./policies");
const logger_1 = require("../jsutils/logger");
function createCacheEnvironment(config) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const possibleTypes = config === null || config === void 0 ? void 0 : config.possibleTypes;
    const typePolicies = (config === null || config === void 0 ? void 0 : config.typePolicies) ? { ...config.typePolicies } : {};
    if (possibleTypes) {
        inheritTypePolicies(typePolicies, possibleTypes);
    }
    let id = 0;
    let tick = 0;
    const env = {
        addTypename: (_a = config === null || config === void 0 ? void 0 : config.addTypename) !== null && _a !== void 0 ? _a : true,
        apolloCompat_keepOrphanNodes: (_b = config === null || config === void 0 ? void 0 : config.apolloCompat_keepOrphanNodes) !== null && _b !== void 0 ? _b : false,
        possibleTypes,
        typePolicies,
        dataIdFromObject: config === null || config === void 0 ? void 0 : config.dataIdFromObject,
        keyMap: new WeakMap(),
        rootTypes: {
            query: "Query",
            mutation: "Mutation",
            subscription: "Subscription",
        },
        mergePolicies: new Map(),
        readPolicies: new Map(),
        autoEvict: (_c = config === null || config === void 0 ? void 0 : config.autoEvict) !== null && _c !== void 0 ? _c : true,
        logUpdateStats: (_d = config === null || config === void 0 ? void 0 : config.logUpdateStats) !== null && _d !== void 0 ? _d : false,
        logStaleOperations: (_e = config === null || config === void 0 ? void 0 : config.logStaleOperations) !== null && _e !== void 0 ? _e : false,
        optimizeFragmentReads: (_f = config === null || config === void 0 ? void 0 : config.optimizeFragmentReads) !== null && _f !== void 0 ? _f : false,
        nonEvictableQueries: (_g = config === null || config === void 0 ? void 0 : config.nonEvictableQueries) !== null && _g !== void 0 ? _g : new Set(),
        maxOperationCount: (_h = config === null || config === void 0 ? void 0 : config.maxOperationCount) !== null && _h !== void 0 ? _h : 1000,
        partitionConfig: config === null || config === void 0 ? void 0 : config.unstable_partitionConfig,
        logger: (0, logger_1.createExtendedLogger)(config && "logger" in config ? config.logger : logger_1.logger),
        notify: config === null || config === void 0 ? void 0 : config.notify,
        now: () => ++tick, // Logical time
        genId: () => ++id,
        objectKey: (object, selection, operation) => (0, keys_1.objectKey)(env, object, selection, operation),
        keyArgs: (typeName, fieldName, args, directives, source) => (0, keys_1.keyArgs)(env, typeName, fieldName, args, directives, source),
    };
    cachePolicies(env);
    return env;
}
function inheritTypePolicies(typePolicies, possibleTypes) {
    for (const [abstractType, concreteTypes] of Object.entries(possibleTypes)) {
        if (!typePolicies[abstractType]) {
            continue;
        }
        for (const concreteType of concreteTypes) {
            typePolicies[concreteType] = inheritTypePolicy(typePolicies[abstractType], typePolicies[concreteType]);
        }
    }
}
function inheritTypePolicy(abstractType, concreteType) {
    if (!concreteType) {
        return abstractType;
    }
    let fields = concreteType.fields;
    if (!fields) {
        fields = abstractType.fields;
    }
    else if (typeof fields === "object" && fields !== null) {
        if (typeof abstractType.fields === "object" && fields !== null) {
            fields = {
                ...abstractType.fields,
                ...fields,
            };
        }
    }
    return {
        ...abstractType,
        ...concreteType,
        fields,
    };
}
function cachePolicies({ readPolicies, mergePolicies, typePolicies, }) {
    const entries = Object.entries(typePolicies);
    for (const [typeName, policy] of entries) {
        if (!policy.fields) {
            continue;
        }
        for (const field of Object.keys(policy.fields)) {
            const readFn = (0, policies_1.getReadPolicyFn)(policy.fields, field);
            const mergeFn = (0, policies_1.getMergePolicyFn)(policy.fields, field);
            if (readFn) {
                let tmp = readPolicies.get(typeName);
                if (!tmp) {
                    tmp = new Map();
                    readPolicies.set(typeName, tmp);
                }
                tmp.set(field, readFn);
            }
            if (mergeFn) {
                let tmp = mergePolicies.get(typeName);
                if (!tmp) {
                    tmp = new Map();
                    mergePolicies.set(typeName, tmp);
                }
                tmp.set(field, mergeFn);
            }
        }
    }
}
