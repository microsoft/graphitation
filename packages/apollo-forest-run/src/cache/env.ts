import { TypePolicies } from "@apollo/client";
import {
  CacheConfig,
  CacheEnv,
  PartitionConfig,
  ResolvedPartitionConfig,
  ResolvedPartitionOptions,
  ScheduleEviction,
} from "./types";
import { keyArgs, objectKey } from "./keys";
import { TypePolicy } from "@apollo/client/cache/inmemory/policies";
import {
  ArgumentValues,
  Directives,
  OperationDescriptor,
  PossibleSelection,
  PossibleTypes,
} from "../descriptor/types";
import { getMergePolicyFn, getReadPolicyFn } from "./policies";
import { SourceObject } from "../values/types";
import { createExtendedLogger, logger } from "../jsutils/logger";

export function createCacheEnvironment(config?: CacheConfig): CacheEnv {
  const possibleTypes = config?.possibleTypes;
  const typePolicies = config?.typePolicies ? { ...config.typePolicies } : {};
  if (possibleTypes) {
    inheritTypePolicies(typePolicies, possibleTypes);
  }

  let id = 0;
  let tick = 0;

  const env: CacheEnv = {
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
    logUpdateStats: config?.logUpdateStats ?? false,
    logStaleOperations: config?.logStaleOperations ?? false,
    historyConfig: config?.historyConfig,
    optimizeFragmentReads: config?.optimizeFragmentReads ?? false,
    nonEvictableQueries: config?.nonEvictableQueries ?? new Set(),
    partitionConfig: resolvePartitionConfig(
      {
        autoEvict: config?.autoEvict ?? true,
        maxOperationCount: config?.maxOperationCount ?? 1000,
      },
      config?.partitionConfig,
    ),
    scheduleAutoEviction: config?.scheduleAutoEviction ?? runAutoEvictionSync,
    logger: createExtendedLogger(
      config && "logger" in config ? config.logger : logger,
    ),
    notify: config?.notify,
    now: () => ++tick, // Logical time
    genId: () => ++id,
    objectKey: (
      object: object,
      selection?: PossibleSelection,
      operation?: OperationDescriptor,
    ) => objectKey(env, object as SourceObject, selection, operation),
    keyArgs: (
      typeName: string,
      fieldName: string,
      args?: ArgumentValues,
      directives?: Directives,
      source?: OperationDescriptor,
    ) => keyArgs(env, typeName, fieldName, args, directives, source),
  };
  cachePolicies(env);
  return env;
}

const runAutoEvictionSync: ScheduleEviction = (run) => {
  run();
  return null;
};

function resolvePartitionConfig(
  defaults: ResolvedPartitionOptions,
  input?: PartitionConfig,
): ResolvedPartitionConfig {
  const { autoEvict, maxOperationCount } = defaults;
  const partitions: ResolvedPartitionConfig["partitions"] = {
    __default__: {
      maxOperationCount,
      autoEvict,
    },
  };
  if (input) {
    for (const key in input.partitions) {
      const p = input.partitions[key];
      partitions[key] = {
        maxOperationCount: p.maxOperationCount,
        autoEvict: p.autoEvict ?? autoEvict,
      };
    }
  }
  const partitionKey = input?.partitionKey ?? (() => null);
  return {
    partitions,
    partitionKey,
  };
}

function inheritTypePolicies(
  typePolicies: TypePolicies,
  possibleTypes: PossibleTypes,
) {
  for (const [abstractType, concreteTypes] of Object.entries(possibleTypes)) {
    if (!typePolicies[abstractType]) {
      continue;
    }
    for (const concreteType of concreteTypes) {
      typePolicies[concreteType] = inheritTypePolicy(
        typePolicies[abstractType],
        typePolicies[concreteType],
      );
    }
  }
}

function inheritTypePolicy(
  abstractType: TypePolicy,
  concreteType: TypePolicy | undefined,
): TypePolicy {
  if (!concreteType) {
    return abstractType;
  }
  let fields = concreteType.fields;
  if (!fields) {
    fields = abstractType.fields;
  } else if (typeof fields === "object" && fields !== null) {
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

function cachePolicies({
  readPolicies,
  mergePolicies,
  typePolicies,
}: CacheEnv) {
  const entries = Object.entries(typePolicies);
  for (const [typeName, policy] of entries) {
    if (!policy.fields) {
      continue;
    }
    for (const field of Object.keys(policy.fields)) {
      const readFn = getReadPolicyFn(policy.fields, field);
      const mergeFn = getMergePolicyFn(policy.fields, field);
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
