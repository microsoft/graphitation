import type { Draft } from "../forest/types";
import type {
  CompositeListChunk,
  GraphChunk,
  ObjectChunk,
  SourceObject,
} from "../values/types";
import type { SplicedIncrementalResult, SpliceState } from "./types";
import type { FieldInfo } from "../descriptor/types";
import type { GraphDifference } from "../diff/diffTree";
import { DiffErrorKind } from "../diff/types";
import { assert } from "../jsutils/assert";
import {
  copySourcesUpToRoot,
  isCompositeListValue,
  isObjectValue,
  resolveFieldChunk,
} from "../values";
import { isSourceData } from "./data";
import { resolveListItem } from "./placeholders";

/**
 * Fields delivered to other objects (with another identity) than the local objects at their locations are missing
 * in the local objects (unless they have them): reads of the operation are incomplete (e.g. refetch the result).
 * Missing fields are marked down to leaves through local objects and lists (positionally: marking only).
 * Note: list items are resolved by keys (local lists may legitimately differ), so items skipped there are not marked.
 */
export function markSkippedFieldsMissing(state: SpliceState) {
  for (const { chunk, data } of state.skipped) {
    markMissingFields(state, chunk, data);
  }
}

function markMissingFields(
  state: SpliceState,
  chunk: ObjectChunk,
  data: SourceObject,
) {
  // Fields delivered to the object by this payload (e.g. by another result: objects are resolved by keys)
  const copy = state.copies.get(chunk.data);
  const delivered =
    copy && !Array.isArray(copy) ? state.deliveredFields.get(copy) : undefined;
  let missingFields: FieldInfo[] | undefined;
  for (const field of chunk.selection.fieldQueue) {
    const value = data[field.dataKey];
    if (value === undefined || delivered?.has(field.dataKey)) {
      continue;
    }
    if (
      chunk.data[field.dataKey] === undefined ||
      chunk.missingFields?.has(field)
    ) {
      missingFields ??= [];
      missingFields.push(field);
    } else if (field.selection && value !== null && typeof value === "object") {
      markMissingValueFields(state, resolveFieldChunk(chunk, field), value);
    }
  }
  if (!missingFields) {
    return;
  }
  // Same values (missing) are not compared when diffing: report missing fields of the stored result explicitly
  state.missingBaseFields.push({
    kind: DiffErrorKind.MissingBaseFields,
    chunk,
    missingFields,
  });
  copySourcesUpToRoot(
    state.tree.dataMap,
    state.copies,
    chunk,
    (value, _, copy, existing) => visitCopy(state, value, copy, existing),
  );
  const target = state.copies.get(chunk.data);
  assert(target && !Array.isArray(target));
  let missing = state.missingFields.get(target);
  if (!missing) {
    missing = new Set();
    state.missingFields.set(target, missing);
  }
  for (const field of missingFields) {
    missing.add(field);
  }
}

function markMissingValueFields(
  state: SpliceState,
  value: GraphChunk,
  data: unknown,
) {
  if (isObjectValue(value) && isSourceData(data)) {
    markMissingFields(state, value, data);
  } else if (isCompositeListValue(value) && Array.isArray(data)) {
    for (let index = 0; index < data.length; index++) {
      const item = resolveListItem(value, index);
      if (item) {
        markMissingValueFields(state, item, data[index]);
      }
    }
  }
}

/**
 * Fields of local objects delivered to other objects (see markSkippedFieldsMissing) are missing in the stored result:
 *   reported as diff errors (marks stored chunks incomplete, so reads report missing data)
 */
export function addMissingBaseFields(
  difference: GraphDifference,
  { missingBaseFields }: SplicedIncrementalResult,
) {
  if (!missingBaseFields.length) {
    return;
  }
  // A single error of this kind is expected (see processDiffErrors)
  for (const error of difference.errors) {
    if (error.kind === "MissingFields") {
      error.base = error.base
        ? [...error.base, ...missingBaseFields]
        : missingBaseFields;
      return;
    }
  }
  difference.errors.push({ kind: "MissingFields", base: missingBaseFields });
}

export function isMissingField(
  missing: Set<FieldInfo> | undefined,
  key: string,
): boolean {
  for (const field of missing ?? EMPTY_ARRAY) {
    if (field.dataKey === key) {
      return true;
    }
  }
  return false;
}

export function hasDeliveredFields({ deliveredFields }: SpliceState): boolean {
  for (const fields of deliveredFields.values()) {
    if (fields.size) {
      return true;
    }
  }
  return false;
}

// Collects state of a copied object (on the path to a delivered object, from the root down)
export function visitCopy(
  state: SpliceState,
  chunk: ObjectChunk | CompositeListChunk,
  copy: Draft,
  existingCopy: Draft | undefined,
) {
  if (!existingCopy && isObjectValue(chunk) && !Array.isArray(copy)) {
    // Objects of the stored result have no delivered fields yet
    state.deliveredFields.set(copy, new Set());
    if (chunk.missingFields?.size) {
      // Data of missing fields may be stale (e.g. fields deleted by cache.modify)
      for (const field of chunk.missingFields) {
        delete copy[field.dataKey];
      }
      state.missingFields.set(copy, new Set(chunk.missingFields));
    }
  }
}

const EMPTY_ARRAY = Object.freeze([]);
