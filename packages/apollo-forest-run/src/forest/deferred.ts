import { accumulate } from "../jsutils/map";
import { ObjectChunk, SourceObject } from "../values/types";
import { PossibleSelections } from "../descriptor/types";

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
  readonly byPath = new Map<string, DeferredPlaceholder[]>();
  readonly embedded = new Map<SourceObject, Set<DeferredPlaceholder>>();

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

  consume(key: string, site: DeferredPlaceholder) {
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
