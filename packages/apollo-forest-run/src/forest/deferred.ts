import { accumulate, accumulateMany, deleteAccumulated } from "../jsutils/map";
import { ObjectChunk, SourceObject } from "../values/types";
import { OperationDescriptor, PossibleSelections } from "../descriptor/types";
import { resolveSelection } from "../descriptor/resolvedSelection";
import { isSourceObject } from "../values/predicates";

type Path = readonly (string | number)[];
export const deferredPathKey = (path: Path, label?: string) =>
  JSON.stringify([label, path]);
export type DeferredPlaceholder = {
  chunk: ObjectChunk;
  selection: PossibleSelections;
};

/** Request-local indexes. Network coordinates never change; the secondary
 * index lets an update rebind an embedded chunk it materialized without
 * scanning every other pending object in the response. */
export class DeferredIndex {
  private readonly byPath = new Map<string, DeferredPlaceholder[]>();
  private readonly embedded = new Map<SourceObject, DeferredPlaceholder[]>();

  get hasPending() {
    return this.byPath.size !== 0;
  }

  get hasEmbedded() {
    return this.embedded.size !== 0;
  }

  clear() {
    this.byPath.clear();
    this.embedded.clear();
  }

  add(key: string, chunk: ObjectChunk, selection: PossibleSelections) {
    if (
      this.byPath
        .get(key)
        ?.some((p) => p.chunk === chunk && p.selection === selection)
    )
      return;
    const site = { chunk, selection };
    accumulate(this.byPath, key, site);
    if (chunk.key === false) accumulate(this.embedded, chunk.data, site);
  }

  matchPatch(
    operation: OperationDescriptor,
    path: Path,
    label: string | undefined,
    data: unknown,
  ): DeferredPlaceholder | undefined {
    const key = deferredPathKey(path, label);
    const candidates = this.byPath.get(key);
    if (!candidates) return;
    const matches =
      candidates.length === 1
        ? candidates
        : candidates.filter(
            ({ chunk, selection }) =>
              isSourceObject(data) &&
              acceptsPayload(operation, selection, data, chunk.type || null),
          );
    const site = matches[0];
    // An unlabeled patch containing only shared fields can be applied once,
    // but cannot tell us which of the matching sites has been delivered.
    if (matches.length === 1) {
      deleteAccumulated(this.byPath, key, site);
      if (site.chunk.key === false)
        deleteAccumulated(this.embedded, site.chunk.data, site);
    }
    return site;
  }

  rebind(source: SourceObject, chunk: ObjectChunk) {
    const sites = this.embedded.get(source);
    if (!sites || source === chunk.data) return;
    this.embedded.delete(source);
    for (const site of sites) site.chunk = chunk;
    accumulateMany(this.embedded, chunk.data, sites, false);
  }
}

export type DeliveryScope = {
  index: DeferredIndex;
  path: Path;
  rootOwner?: ObjectChunk;
};

function acceptsPayload(
  operation: OperationDescriptor,
  selections: PossibleSelections,
  data: unknown,
  type?: string | null,
): boolean {
  if (!isSourceObject(data)) return true;
  if (Array.isArray(data))
    return data.every((item) => acceptsPayload(operation, selections, item));
  const fields = resolveSelection(
    operation,
    selections,
    type === undefined ? data.__typename ?? null : type,
  ).fieldQueue;
  return Object.keys(data).every((key) => {
    if (key === "__typename") return true;
    const field = fields.find((f) => f.dataKey === key);
    if (!field) return false;
    return (
      !field.selection || acceptsPayload(operation, field.selection, data[key])
    );
  });
}
