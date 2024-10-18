import type { Reference, StoreObject } from "@apollo/client";
import type {
  ArgumentValues,
  Directives,
  Key,
  OperationDescriptor,
  PossibleSelection,
} from "../descriptor/types";
import type { CacheEnv } from "./types";
import type { KeySpecifier, SourceObject } from "../values/types";
import { sortKeys } from "./extract";
import { assert } from "../jsutils/assert";
import { ROOT_TYPES } from "./descriptor";

export function identify(
  env: CacheEnv,
  object: Reference | StoreObject,
): string | undefined {
  try {
    const value = object.__ref ?? objectKey(env, object as SourceObject);
    return typeof value !== "string" ? undefined : value;
  } catch (e) {
    console.warn(e);
    return undefined;
  }
}

export function objectKey(
  { keyMap, dataIdFromObject, typePolicies }: CacheEnv,
  object: SourceObject,
  selection?: PossibleSelection,
  operation?: OperationDescriptor,
): string | false | undefined {
  // ApolloCompat: this is necessary for compatibility with extract/restore methods
  //   (where object key is not inferable otherwise)
  const key = keyMap?.get(object);
  if (key !== undefined) {
    return key;
  }
  const typeName = object.__typename;
  if (!typeName || ROOT_TYPES.includes(typeName)) {
    // ApolloCompat
    // TODO: pass proper Apollo-compatible context in the 2nd argument.
    //  For now passing empty objects to satisfy TMP unit tests
    // FIXME: should we return root node keys for default types?
    const key = dataIdFromObject?.(object, {});
    return typeof key === "number" ? String(key) : key;
  }
  const typePolicy = typePolicies[typeName];

  if (typePolicy?.keyFields) {
    // TODO: Move typePolicy validation to creation time (for perf)
    const keyFields =
      typeof typePolicy?.keyFields === "function"
        ? typePolicy.keyFields(object, {
            readField,
            typename: typeName,
            fragmentMap: Object.fromEntries(
              operation?.fragmentMap.entries() ?? [],
            ),
          } as any)
        : typePolicy?.keyFields;

    if (keyFields === false) {
      return false;
    }

    if (!Array.isArray(keyFields)) {
      throw new Error(`Only simple keyFields are supported`);
    }
    const idParts: Record<string, unknown> = {};
    for (const field of keyFields) {
      if (typeof field !== "string") {
        throw new Error(`Only simple keyFields are supported`);
      }
      const dataKey = resolveDataKey(field, selection);
      const fieldValue = object[dataKey];
      if (typeof fieldValue === "undefined") {
        throw new Error(
          `Missing field '${field}' while extracting keyFields from ${inspect(
            object,
          )}`,
        );
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

export function keyArgs(
  env: CacheEnv,
  typeName: string,
  fieldName: string,
  args?: ArgumentValues,
  directives?: Directives,
  source?: OperationDescriptor,
): Key | KeySpecifier | undefined {
  const fieldPolicy = env.typePolicies[typeName]?.fields?.[fieldName];
  if (!fieldPolicy) {
    return directives?.size
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
    keyArgs = fieldPolicy.keyArgs(
      args ? Object.fromEntries(args.entries()) : {},
      {
        typename: typeName,
        fieldName,
        field: null,
        variables: source?.variablesWithDefaults,
      },
    );
  } else {
    keyArgs = fieldPolicy.keyArgs;
  }
  if (
    keyArgs === undefined &&
    typeof fieldPolicy.merge === "function" &&
    typeof fieldPolicy.read === "function"
  ) {
    // ApolloCompat: merge and read are responsible for taking care of args
    keyArgs = false;
  }
  return keyArgs === false
    ? EMPTY_ARRAY
    : (keyArgs as Key | KeySpecifier | undefined);
}

export function keyFromConnectionDirective(
  directives: Directives,
  args?: ArgumentValues,
): Key | undefined {
  const connectionDirective = directives.get("connection");
  if (!connectionDirective) {
    return undefined;
  }
  const key = connectionDirective.args.get("key");
  const filterKeys = connectionDirective.args.get("filter");

  if (Array.isArray(filterKeys) && filterKeys.length > 0) {
    const filteredArgs = filterKeys.reduce((acc, key) => {
      acc[key] = args?.get(key);
      return acc;
    }, {});
    return key + `(${inspect(sortKeys(filteredArgs))})`;
  }
  assert(typeof key === "string" || key === undefined);
  return key;
}

function readField(fieldName: string, from: SourceObject | Reference) {
  if (typeof fieldName === "object") {
    throw new Error("Not implemented in ForestRun");
  }
  if (from.__ref) {
    throw new Error("Not implemented in ForestRun");
  }
  return (from as Record<string, unknown>)[fieldName];
}

function resolveDataKey(
  canonicalFieldName: string,
  selection?: PossibleSelection,
) {
  if (!selection) {
    return canonicalFieldName;
  }
  const idFieldInfo = selection.fields.get(canonicalFieldName);
  if (idFieldInfo && idFieldInfo?.length > 0) {
    return idFieldInfo[0].dataKey;
  }
  return canonicalFieldName;
}

const inspect = JSON.stringify.bind(JSON);
const EMPTY_ARRAY = Object.freeze([]);
