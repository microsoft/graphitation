"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCacheEnvironment = createCacheEnvironment;
const keys_1 = require("./keys");
const policies_1 = require("./policies");
const logger_1 = require("../jsutils/logger");
function createCacheEnvironment(config) {
    const possibleTypes = config?.possibleTypes;
    const typePolicies = config?.typePolicies ? { ...config.typePolicies } : {};
    if (possibleTypes) {
        inheritTypePolicies(typePolicies, possibleTypes);
    }
    let id = 0;
    let tick = 0;
    const env = {
        addTypename: config?.addTypename ?? true,
        apolloCompat_keepOrphanNodes: config?.apolloCompat_keepOrphanNodes ?? false,
        possibleTypes,
        typePolicies,
        dataIdFromObject: config?.dataIdFromObject,
        keyMap: new WeakMap(),
        rootTypes: {
            query: "Query",
            mutation: "Mutation",
            subscription: "Subscription",
        },
        mergePolicies: new Map(),
        readPolicies: new Map(),
        autoEvict: config?.autoEvict ?? true,
        logUpdateStats: config?.logUpdateStats ?? false,
        logStaleOperations: config?.logStaleOperations ?? false,
        optimizeFragmentReads: config?.optimizeFragmentReads ?? false,
        nonEvictableQueries: config?.nonEvictableQueries ?? new Set(),
        maxOperationCount: config?.maxOperationCount ?? 1000,
        partitionConfig: config?.unstable_partitionConfig,
        logger: (0, logger_1.createExtendedLogger)(config && "logger" in config ? config.logger : logger_1.logger),
        notify: config?.notify,
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
