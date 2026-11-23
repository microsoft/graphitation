import { accumulate } from "../jsutils/map";
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
  private readonly embedded = new Map<SourceObject, Set<DeferredPlaceholder>>();

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
    if (chunk.key === false) {
      const sites = this.embedded.get(chunk.data) ?? new Set();
      sites.add(site);
      this.embedded.set(chunk.data, sites);
    }
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
            (site) =>
              isSourceObject(data) &&
              acceptsPayload(
                operation,
                site.selection,
                site.chunk.type || null,
                data,
              ),
          );
    const site = matches[0];
    // An unlabeled patch containing only shared fields can be applied once,
    // but cannot tell us which of the matching sites has been delivered.
    if (matches.length === 1) this.consume(key, site);
    return site;
  }

  private consume(key: string, site: DeferredPlaceholder) {
    const sites = this.byPath.get(key)!;
    sites.splice(sites.indexOf(site), 1);
    if (!sites.length) this.byPath.delete(key);
    const embedded = this.embedded.get(site.chunk.data);
    if (embedded?.delete(site) && !embedded.size)
      this.embedded.delete(site.chunk.data);
  }

  rebind(source: SourceObject, chunk: ObjectChunk) {
    const sites = this.embedded.get(source);
    if (!sites || source === chunk.data) return;
    this.embedded.delete(source);
    for (const site of sites) site.chunk = chunk;
    const existing = this.embedded.get(chunk.data);
    if (existing) for (const site of sites) existing.add(site);
    else this.embedded.set(chunk.data, sites);
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
  type: string | null,
  data: SourceObject,
): boolean {
  if (Array.isArray(data))
    return data.every(
      (item) =>
        !isSourceObject(item) ||
        acceptsPayload(operation, selections, item.__typename ?? null, item),
    );
  const fields = resolveSelection(operation, selections, type).fieldQueue;
  return Object.keys(data).every((key) => {
    if (key === "__typename") return true;
    const field = fields.find((f) => f.dataKey === key);
    if (!field) return false;
    const value = data[key];
    return (
      !field.selection ||
      !isSourceObject(value) ||
      acceptsPayload(
        operation,
        field.selection,
        value.__typename ?? null,
        value,
      )
    );
  });
}
