import { TypeName } from "../../descriptor/types";
import {
  CompositeListChunk,
  CompositeValueChunk,
  ObjectChunk,
  ValueKind,
} from "../../values/types";
import { MutationStats, UpdateTreeStats } from "./types";

export class UpdateLogger {
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

  private createMutation(
    nodeType: TypeName | false,
    depth: number,
  ): MutationStats {
    return {
      nodeType: nodeType || "UNKNOWN_OBJECT",
      depth,
      fieldsMutated: 0,
      itemsMutated: 0,
    };
  }

  private copyArray(chunk: CompositeListChunk) {
    const copiedItems = chunk.itemChunks.length;

    this.stats.arraysCopied++;
    this.stats.arrayItemsCopied += copiedItems;
    this.updateHeaviestArrayCopy(chunk, copiedItems);
  }

  private updateHeaviestArrayCopy(
    chunk: CompositeListChunk,
    copiedItems: number,
  ) {
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
      };
    }
  }

  private copyObject(chunk: ObjectChunk) {
    const copiedFields = chunk.selection.fieldQueue.length;

    this.stats.objectsCopied++;
    this.stats.objectFieldsCopied += copiedFields;
    this.updateHeaviestObjectCopy(chunk, copiedFields);
  }

  private updateHeaviestObjectCopy(chunk: ObjectChunk, copiedFields: number) {
    if (copiedFields > (this.stats.heaviestObjectCopy?.size ?? 0)) {
      this.stats.heaviestObjectCopy = {
        nodeType: chunk.type || "UNKNOWN_OBJECT",
        size: copiedFields,
        depth: chunk.selection.depth,
      };
    }
  }

  startMutation(nodeType: TypeName | false, depth: number) {
    this.currentMutation = this.createMutation(nodeType, depth);
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
        this.copyObject(chunk);
        break;
      }
      case ValueKind.CompositeList: {
        this.copyArray(chunk);
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

class DummyUpdateLogger implements Pick<UpdateLogger, keyof UpdateLogger> {
  startMutation() {}
  finishMutation() {}
  copy() {}
  fieldMutation() {}
  itemMutation() {}
  getStats() {
    return {};
  }
}

export function createUpdateLogger(enabled = true): UpdateLogger {
  return enabled
    ? new UpdateLogger()
    : (new DummyUpdateLogger() as unknown as UpdateLogger);
}
