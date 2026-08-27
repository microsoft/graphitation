import type {
  CompositeListChunk,
  GraphChunkReference,
  NodeChunk,
  ObjectChunk,
  ObjectFieldReference,
  ParentLocator,
} from "./types";
import type { NormalizedFieldEntry } from "../descriptor/types";
import {
  getFieldName,
  resolveNormalizedField,
} from "../descriptor/resolvedSelection";
import { findClosestNode, getDataPathForDebugging } from "./traverse";
import { isParentListRef, isParentObjectRef } from "./predicates";

const EMPTY_ARRAY = Object.freeze([]) as unknown as never[];

export type MalformedListOccurrence = {
  list: CompositeListChunk;
  findParent: ParentLocator;
};

/**
 * Everything printed here ships to telemetry: schema level names, data paths and item counts
 * only. Never the node key (it embeds the entity id) or argument values.
 *
 * Callers hand this a payload that is already known to be broken, so the whole description is
 * guarded: a throw while walking a damaged tree would replace a diagnosable report with an
 * unrelated stack trace. On failure it degrades to what can be read off the chunk itself.
 */
export function reportMalformedList(
  damaged: CompositeListChunk,
  getOccurrences: () => MalformedListOccurrence[],
): string {
  try {
    const occurrences = getOccurrences();
    const primary =
      occurrences.find((o) => o.list === damaged) ?? occurrences[0];
    return describeMalformedList(occurrences, primary);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    return (
      `Detected malformed payload written to the cache: a list holds fewer items than the ` +
      `chunks referencing it.\n\n` +
      `  Operation:  ${
        damaged.operation?.debugName ?? "(unknown operation)"
      }\n` +
      `  Items:      ${damaged.data?.length ?? "(unknown)"}\n\n` +
      `  (reporting failed: ${reason})`
    );
  }
}

function describeMalformedList(
  occurrences: MalformedListOccurrence[],
  damaged: MalformedListOccurrence,
): string {
  const { list, findParent } = damaged;
  const owner = findOwningField(findParent, findParent(list));
  const fieldEntry = owner
    ? resolveNormalizedField(owner.parent.selection, owner.field)
    : null;
  const fieldName = fieldEntry ? getFieldName(fieldEntry) : "(unknown field)";
  // The object owning the list may itself be embedded and keyless (a Relay connection is the
  // common case), and a keyless object cannot be repeated on its own: what occurs multiple
  // times is the closest keyed ancestor, so that is what gets named.
  const node = owner && findClosestNode(owner.parent, findParent);
  const embedded = typeof owner?.parent.key !== "string";
  const objectType = owner?.parent.type || "(unknown type)";
  const nodeType = node?.type || "(unknown type)";

  // The list belongs to the node itself, or to an object embedded under it. Both report the
  // type actually declaring the field, so the embedded case has to name the node separately -
  // it is the one repeated, and the one to look for in the payload.
  const nodeIdRow: [string, string][] =
    // Occurrences are collected by node key, so they are the same entity by construction.
    occurrences.length > 1
      ? [
          [
            embedded ? "Parent node id" : "Node id",
            "same in all occurrences (not shown)",
          ],
        ]
      : [];
  const rows: [string, string][] = embedded
    ? [
        ["Operation", list.operation.debugName],
        ["Object type", objectType],
        ["Parent node type", nodeType],
        ...nodeIdRow,
        ["Field", fieldEntry ? describeFieldEntry(fieldEntry) : fieldName],
        // Where the object sits under the node - the data paths below cross node boundaries
        // without marking them, so this is what ties the two together.
        ["Path in node", describePath(findParent, list, node)],
      ]
    : [
        ["Operation", list.operation.debugName],
        ["Node type", nodeType],
        ...nodeIdRow,
        ["Field", fieldEntry ? describeFieldEntry(fieldEntry) : fieldName],
      ];
  // Two spaces after the longest label, matching the layout the single node branch has always used.
  const labelWidth = Math.max(...rows.map(([label]) => label.length)) + 3;

  return [
    `Detected malformed payload written to the cache: a "${objectType}" ` +
      (embedded ? `object embedded in a "${nodeType}" node ` : `node `) +
      `occurs multiple times in a single write with a different number of items ` +
      `in the "${fieldName}" list.`,
    ``,
    ...rows.map(([label, value]) => `  ${`${label}:`.padEnd(labelWidth)}${value}`), // prettier-ignore
    ``,
    ...occurrences.map((occurrence, i) => {
      const items = occurrence.list.data.length;
      return (
        `  Occurrence ${i + 1}: ${items} ${items === 1 ? "item" : "items"} ` +
        `at ${describePath(occurrence.findParent, occurrence.list)}` +
        describeSlots(occurrence.list)
      );
    }),
  ].join("\n");
}

/**
 * A hole punched past the payload length tells us how long the *other* occurrence was even
 * when it cannot be found. Contiguous holes from zero point at an aggregate overrun, sparse
 * or offset ones at a stale layout.
 */
function describeSlots(list: CompositeListChunk): string {
  const slots = list.itemChunks.length;
  if (slots === list.data.length) {
    return "";
  }
  const holes: number[] = [];
  for (let i = 0; i < slots; i++) {
    if (list.itemChunks[i] === undefined) {
      holes.push(i);
    }
  }
  return ` (${slots} slots, holes at ${
    holes.length ? holes.join(",") : "none"
  })`;
}

// A list of lists has no field of its own: walk up to the field the outermost list is assigned to.
export function findOwningField(
  findParent: ParentLocator,
  parent: GraphChunkReference,
): ObjectFieldReference | null {
  let ref = parent;
  while (isParentListRef(ref)) {
    ref = findParent(ref.parent);
  }
  return isParentObjectRef(ref) ? ref : null;
}

function describeFieldEntry(fieldEntry: NormalizedFieldEntry): string {
  if (typeof fieldEntry === "string") {
    return fieldEntry;
  }
  // Argument *names* are schema, argument values are not: elide the values.
  const args = [...(fieldEntry.args?.keys() ?? EMPTY_ARRAY)]
    .map((name) => `${name}: ...`)
    .join(", ");
  return args ? `${fieldEntry.name}(${args})` : fieldEntry.name;
}

// Absolute when `from` is omitted, node relative otherwise.
function describePath(
  findParent: ParentLocator,
  list: CompositeListChunk,
  from?: ObjectChunk | CompositeListChunk | NodeChunk | null,
): string {
  const path = getDataPathForDebugging({ findParent }, list, from ?? undefined);
  return from ? path.join(".") : `data${path.map((s) => `.${s}`).join("")}`;
}
