import { ResolvedSelection, TypeName } from "../../descriptor/types";
import {
  CompositeListChunk,
  CompositeValueChunk,
  ValueKind,
} from "../../values/types";
import { UpdateLoggerAbstract, MutationStats, UpdateTreeStats } from "./types";

class UpdateLogger implements UpdateLoggerAbstract {
  private stats: UpdateTreeStats;
  private currentMutation: MutationStats | null;

  constructor() {
    this.stats = {
      arraysCopied: 0,
      arrayItemsCopied: 0,
      objectsCopied: 0,
      objectFieldsCopied: 0,
      heaviestArrayCopy: undefined,
      heaviestObjectCopy: undefined,
      mutations: [],
    };

    this.currentMutation = null;
  }

  #createMutation(nodeType: TypeName | false, depth: number): MutationStats {
    return {
      nodeType: nodeType || "UNKNOWN_OBJECT",
      depth: depth,
      fieldsMutated: 0,
      itemsMutated: 0,
    };
  }

  #copyArray(chunk: CompositeListChunk) {
    const copiedItems = chunk.itemChunks.length;
    this.stats.arraysCopied++;
    this.stats.arrayItemsCopied += copiedItems;

    if (copiedItems > (this.stats.heaviestArrayCopy?.size ?? 0)) {
      const itemChunk = chunk.itemChunks[0];
      let nodeType: TypeName = "UNKNOWN_ARRAY";
      let depth = 0;

      if (itemChunk.value.kind === ValueKind.Object) {
        nodeType = itemChunk.value.type || "UNKNOWN_OBJECT";
        depth = itemChunk.value.selection.depth;
      }

      this.stats.heaviestArrayCopy = {
        nodeType,
        size: copiedItems,
        depth,
        path: [],
      };
    }
  }

  #copyObject(chunk: { selection: ResolvedSelection; type: TypeName | false }) {
    const copiedFields = chunk.selection.fieldQueue.length;
    this.stats.objectsCopied++;
    this.stats.objectFieldsCopied += copiedFields;

    if (copiedFields > (this.stats.heaviestObjectCopy?.size ?? 0)) {
      this.stats.heaviestObjectCopy = {
        nodeType: chunk.type || "UNKNOWN_OBJECT",
        size: copiedFields,
        depth: chunk.selection.depth,
        path: [],
      };
    }
  }

  startMutation(nodeType: TypeName | false, depth: number) {
    this.currentMutation = this.#createMutation(nodeType, depth);
  }

  finishMutation() {
    if (this.currentMutation) {
      this.stats.mutations.push(this.currentMutation);
    }
    this.currentMutation = null;
  }

  copy(chunk: CompositeValueChunk) {
    switch (chunk.kind) {
      case ValueKind.Object: {
        this.#copyObject(chunk);
        break;
      }
      case ValueKind.CompositeList: {
        this.#copyArray(chunk);
        break;
      }
    }
  }

  fieldMutation() {
    if (this.currentMutation) {
      this.currentMutation.fieldsMutated++;
    }
  }

  itemMutation() {
    if (this.currentMutation) {
      this.currentMutation.itemsMutated++;
    }
  }

  getStats(): UpdateTreeStats {
    return this.stats;
  }
}

class DummyUpdateLogger implements UpdateLoggerAbstract {
  startMutation() {}
  finishMutation() {}
  copy() {}
  fieldMutation() {}
  itemMutation() {}
  getStats(): UpdateTreeStats {
    return {
      arraysCopied: 0,
      arrayItemsCopied: 0,
      objectsCopied: 0,
      objectFieldsCopied: 0,
      heaviestArrayCopy: undefined,
      heaviestObjectCopy: undefined,
      mutations: [],
    };
  }
}

export function createUpdateLogger(disabled = false): UpdateLoggerAbstract {
  return disabled ? new DummyUpdateLogger() : new UpdateLogger();
}
