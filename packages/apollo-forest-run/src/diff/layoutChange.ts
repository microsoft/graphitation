import type {
  SourceObject,
  SourceCompositeList,
  MissingFieldsMap,
  CompositeListChunk,
} from "../values/types";
import type {
  CompositeListLayoutChangeItemRemoved,
  CompositeListLayoutChange,
  CompositeListLayoutIndexChange,
  DiffEnv,
} from "./types";
import * as ChangeKind from "./itemChangeKind";
import { ForestEnv } from "../forest/types";

export function createItemRemoved(
  oldIndex: number,
  data: SourceObject | SourceCompositeList,
  env: DiffEnv | ForestEnv,
  chunk: CompositeListChunk,
): CompositeListLayoutChangeItemRemoved | undefined {
  const historySize = chunk.operation.historySize;
  if (!historySize) {
    return undefined;
  }
  return {
    kind: ChangeKind.ItemRemove,
    oldIndex,
    data: env.enableRichHistory ? data : undefined,
  };
}

export function createItemAdded(
  index: number,
  data: SourceObject | SourceCompositeList | null,
  env: DiffEnv | ForestEnv,
  chunk: CompositeListChunk,
  missingFields?: MissingFieldsMap,
): CompositeListLayoutChange | undefined {
  const historySize = chunk?.operation.historySize ?? 0;
  if (!historySize) {
    return undefined;
  }
  return {
    kind: ChangeKind.ItemAdd,
    index,
    data: env.enableRichHistory ? data : undefined,
    missingFields: env.enableRichHistory ? missingFields : undefined,
  };
}

export function createIndexChange(
  index: number,
  oldIndex: number,
  data: SourceObject | SourceCompositeList,
  env: DiffEnv | ForestEnv,
  chunk: CompositeListChunk,
): CompositeListLayoutIndexChange | undefined {
  const historySize = chunk.operation.historySize;
  if (!historySize) {
    return undefined;
  }
  return {
    kind: ChangeKind.ItemIndexChange,
    index,
    oldIndex,
    data: env.enableRichHistory ? data : undefined,
  };
}
