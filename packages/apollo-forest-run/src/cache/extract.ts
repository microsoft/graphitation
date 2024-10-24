import type { StoreObject, StoreValue } from "@apollo/client";
import type { CompositeListValue, NodeMap, ObjectValue } from "../values/types";
import type { CacheEnv, DataForest, OptimisticLayer } from "./types";
import * as Value from "../values";
import { assertNever, assert } from "../jsutils/assert";
import { fieldToStringKey } from "./keys";

// ApolloCompat:
//   Transform forest run layers into Apollo-compatible format (mostly useful for tests)
//   See also: restore.ts
export function extract(
  env: CacheEnv,
  layers: (DataForest | OptimisticLayer)[],
): StoreObject {
  const result: StoreObject = {};
  const extraRootIds: string[] = [];
  const entityMap: NodeMap = new Map();

  for (const forest of layers) {
    for (const [, indexedTree] of forest.trees) {
      for (const [id, chunks] of indexedTree.nodes.entries()) {
        if (forest.deletedNodes.has(id)) {
          entityMap.set(id, []);
          continue;
        }
        let entityChunks = entityMap.get(id);
        if (!entityChunks) {
          entityChunks = [];
          entityMap.set(id, entityChunks);
        }
        entityChunks.push(...chunks);
      }
    }
    extraRootIds.push(...forest.extraRootIds.keys());
  }

  if (extraRootIds.length) {
    result["__META"] = {
      extraRootIds: extraRootIds.sort(),
    };
  }
  for (const [key, entityChunks] of entityMap.entries()) {
    if (entityChunks.length === 0) {
      // Node is considered deleted
      continue;
    }
    const value =
      entityChunks.length === 1
        ? entityChunks[0]
        : Value.createObjectAggregate(entityChunks);
    const entityValue = toNormalizedObject(env, value) as StoreObject;

    if (key === "Query:root" || key === "ROOT_QUERY") {
      entityValue.__typename = "Query";
      result["ROOT_QUERY"] = entityValue;
    } else if (key === "Subscription:root" || key === "ROOT_SUBSCRIPTION") {
      entityValue.__typename = "Subscription";
      result["ROOT_SUBSCRIPTION"] = entityValue;
    } else {
      result[key] = entityValue;
    }
  }
  return result;
}

function toNormalizedObject(
  env: CacheEnv,
  value: ObjectValue,
  allowRef = false,
): StoreObject {
  if (allowRef) {
    let lastError;
    const chunks = Value.isAggregate(value) ? value.chunks : [value];
    for (const chunk of chunks) {
      try {
        const key = env.objectKey(chunk.data, chunk.selection);
        if (key) {
          return { __ref: key }; // FIXME: return type is StoreObject, but we return Reference here
        }
      } catch (e) {
        lastError = e;
      }
    }
    if (lastError) {
      throw lastError;
    }
  }

  const obj: StoreObject = {};

  if (value.data["__typename"]) {
    obj.__typename = value.data["__typename"];
  }
  if (value.type && obj.__typename === undefined) {
    obj.__typename = value.type;
  }
  if (
    value.data["id"] !== undefined &&
    value.data["__typename"] !== "Query" &&
    value.data["id"] !== "root"
  ) {
    obj.id = value.data["id"];
  }

  for (const field of Value.aggregateFieldNames(value)) {
    const fieldEntries = Value.aggregateFieldEntries(value, field);
    if (!fieldEntries) {
      continue;
    }
    const tmp = Array.isArray(fieldEntries) ? fieldEntries : [fieldEntries];

    for (const fieldEntry of tmp) {
      const fieldValue = Value.aggregateFieldValue(value, fieldEntry);

      if (fieldValue === undefined || Value.isMissingValue(fieldValue)) {
        // FIXME: could this happen at all?
        continue;
      }
      const fieldKey = fieldToStringKey(fieldEntry);
      if (Value.isScalarValue(fieldValue)) {
        obj[fieldKey] = fieldValue;
      } else if (
        Value.isLeafListValue(fieldValue) ||
        Value.isComplexScalarValue(fieldValue)
      ) {
        obj[fieldKey] = fieldValue.data;
      } else if (Value.isObjectValue(fieldValue)) {
        obj[fieldKey] = toNormalizedObject(env, fieldValue, true);
      } else if (Value.isCompositeListValue(fieldValue)) {
        obj[fieldKey] = toNormalizedList(env, fieldValue);
      } else if (
        Value.isCompositeNullValue(fieldValue) ||
        Value.isLeafErrorValue(fieldValue) ||
        fieldValue === null
      ) {
        obj[fieldKey] = null;
      } else {
        assertNever(fieldValue);
      }
    }
  }
  return obj;
}

function toNormalizedList(
  env: CacheEnv,
  value: CompositeListValue,
): StoreValue[] {
  const length = value.data.length;
  const list: StoreValue[] = [];
  for (let i = 0; i < length; i++) {
    const item = Value.aggregateListItemValue(value, i);
    assert(item && !Value.isMissingValue(item));

    if (Value.isObjectValue(item)) {
      list.push(toNormalizedObject(env, item, true));
    } else if (Value.isCompositeListValue(item)) {
      list.push(toNormalizedList(env, item));
    } else if (Value.isCompositeNullValue(item)) {
      list.push(null);
    } else {
      assertNever(item);
    }
  }
  return list;
}
