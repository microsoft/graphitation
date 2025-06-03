import type { CacheEnv, Write } from "../cache/types";
import { ResolvedSelection, TypeName } from "../descriptor/types";
import { MutationStats, UpdateTreeStats } from "../forest/types";
import {
  CompositeListChunk,
  CompositeValueChunk,
  ValueKind,
} from "../values/types";

export function logUpdateStats(env: CacheEnv, writes: Write[]) {
  const { logUpdateStats } = env;
  if (!logUpdateStats) {
    return;
  }

  writes.forEach((write) => {
    const { updateStats } = write;
    if (!updateStats || updateStats.size === 0) {
      return;
    }
    env.notify?.({
      type: "UPDATE_STATS",
      causedBy: write.tree.operation.debugName,
      updateStats,
    } as unknown as any);
  });
}

export function logCopyStats(
  stats: UpdateTreeStats,
  chunk: CompositeValueChunk,
) {
  switch (chunk.kind) {
    case ValueKind.Object: {
      logObjectCopyStats(stats, chunk);
      break;
    }
    case ValueKind.CompositeList: {
      logArrayCopyStats(stats, chunk);
      break;
    }
  }
}

function logArrayCopyStats(stats: UpdateTreeStats, chunk: CompositeListChunk) {
  const copiedItems = chunk.itemChunks.length;
  stats.arraysCopied++;
  stats.arrayItemsCopied += copiedItems;

  if (copiedItems > (stats.heaviestArrayCopy?.size ?? 0)) {
    const itemChunk = chunk.itemChunks[0];
    let nodeType: TypeName = "UNKNOWN_ARRAY";
    let depth = 0;

    if (itemChunk.value.kind === ValueKind.Object) {
      nodeType = itemChunk.value.type || "UNKNOWN_OBJECT";
      depth = itemChunk.value.selection.depth;
    }

    stats.heaviestArrayCopy = {
      nodeType,
      size: copiedItems,
      depth,
      path: [],
    };
  }
}

function logObjectCopyStats(
  stats: UpdateTreeStats,
  chunk: {
    selection: ResolvedSelection;
    type: TypeName | false;
  },
) {
  const copiedFields = chunk.selection.fieldQueue.length;
  stats.objectsCopied++;
  stats.objectFieldsCopied += copiedFields;

  if (copiedFields > (stats.heaviestObjectCopy?.size ?? 0)) {
    stats.heaviestObjectCopy = {
      nodeType: chunk.type || "UNKNOWN_OBJECT",
      size: copiedFields,
      depth: chunk.selection.depth,
      path: [],
    };
  }
}

export function logFieldMutation(stats: MutationStats) {
  stats.fieldsMutated++;
}

export function logItemMutation(stats: MutationStats) {
  stats.itemsMutated++;
}
