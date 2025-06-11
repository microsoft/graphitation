import { Draft } from "../../forest/types";
import {
  CompositeListChunk,
  CompositeValueChunk,
  ObjectChunk,
  ValueKind,
} from "../../values/types";
import { CopyStats, ChunkUpdateStats, UpdateTreeStats } from "./types";

function increaseObjectStats(
  stats: CopyStats | undefined,
  copiedFields: number,
): void {
  if (!stats) {
    return;
  }
  stats.objectsCopied++;
  stats.objectFieldsCopied += copiedFields;
}

function increaseArrayStats(
  stats: CopyStats | undefined,
  copiedItems: number,
): void {
  if (!stats) {
    return;
  }
  stats.arraysCopied++;
  stats.arrayItemsCopied += copiedItems;
}

export function makeCopyStats(): CopyStats {
  return {
    arraysCopied: 0,
    arrayItemsCopied: 0,
    objectFieldsCopied: 0,
    objectsCopied: 0,
  };
}

export class UpdateLogger {
  private stats: UpdateTreeStats;
  private currentUpdate: ChunkUpdateStats | undefined;

  constructor() {
    const stats = {
      objectsCopied: 0,
      objectFieldsCopied: 0,
      arraysCopied: 0,
      arrayItemsCopied: 0,
      operationName: "",
      updates: [],
    };
    this.stats = stats;

    this.currentUpdate = undefined;
  }

  copyParentChunkStats(
    chunk: CompositeValueChunk,
    draft: Draft | undefined,
  ): void {
    const isDraft = !!draft;
    this.recordChunkCopy(
      chunk,
      this.currentUpdate?.updateAscendantStats,
      isDraft,
    );
  }

  copyChunkStats(chunk: CompositeValueChunk, draft: Draft | undefined): void {
    const isDraft = !!draft;
    this.recordChunkCopy(chunk, this.currentUpdate?.updateStats, isDraft);
  }

  private recordChunkCopy(
    chunk: CompositeValueChunk,
    stats: CopyStats | undefined,
    isDraft = false, // For operation stats we should log draft just once
  ) {
    switch (chunk.kind) {
      case ValueKind.Object: {
        this.recordObjectCopy(chunk, stats, isDraft);
        break;
      }
      case ValueKind.CompositeList: {
        this.recordArrayCopy(chunk, stats, isDraft);
        break;
      }
    }
  }

  private recordObjectCopy(
    chunk: ObjectChunk,
    stats: CopyStats | undefined,
    isDraft: boolean,
  ) {
    const copiedFields = chunk.selection.fieldQueue.length;
    increaseObjectStats(stats, copiedFields);

    if (!isDraft) {
      increaseObjectStats(this.stats, copiedFields);
    }
  }

  private recordArrayCopy(
    chunk: CompositeListChunk,
    stats: CopyStats | undefined,
    isDraft: boolean,
  ) {
    const copiedItems = chunk.itemChunks.length;
    increaseArrayStats(stats, copiedItems);

    if (!isDraft) {
      increaseArrayStats(this.stats, copiedItems);
    }
  }

  startChunkUpdate(chunk: ObjectChunk): void {
    this.currentUpdate = {
      nodeType: chunk.type || "UNKNOWN_OBJECT",
      depth: chunk.selection.depth,
      updateStats: {
        arraysCopied: 0,
        arrayItemsCopied: 0,
        objectFieldsCopied: 0,
        objectsCopied: 0,
        fieldsMutated: 0,
        itemsMutated: 0,
      },
      updateAscendantStats: makeCopyStats(),
    };
  }

  finishChunkUpdate(): void {
    if (!this.currentUpdate) {
      return;
    }

    this.stats.updates.push(this.currentUpdate);
    this.currentUpdate = undefined;
  }

  fieldMutation() {
    if (this.currentUpdate) {
      this.currentUpdate.updateStats.fieldsMutated++;
    }
  }

  itemMutation() {
    if (this.currentUpdate) {
      this.currentUpdate.updateStats.itemsMutated++;
    }
  }

  getStats(operationName: string): UpdateTreeStats {
    this.stats.operationName = operationName;
    return this.stats;
  }
}

export function createUpdateLogger(enabled = true): UpdateLogger | undefined {
  return enabled ? new UpdateLogger() : undefined;
}
