import type {
  SourceObject,
  SourceCompositeList,
  MissingFieldsMap,
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
): CompositeListLayoutChangeItemRemoved | undefined {
  if (!env.enableHistory) {
    return undefined;
  }
  return {
    kind: ChangeKind.ItemRemove,
    oldIndex,
    data: env.enableDataHistory ? data : undefined,
  };
}

export function createItemAdded(
  index: number,
  data: SourceObject | SourceCompositeList | null,
  env: DiffEnv | ForestEnv,
  missingFields?: MissingFieldsMap,
): CompositeListLayoutChange | undefined {
  if (!env.enableHistory) {
    return undefined;
  }
  return {
    kind: ChangeKind.ItemAdd,
    index,
    data: env.enableDataHistory ? data : undefined,
    missingFields: env.enableDataHistory ? missingFields : undefined,
  };
}

export function createIndexChange(
  index: number,
  oldIndex: number,
  data: SourceObject | SourceCompositeList,
  env: DiffEnv | ForestEnv,
): CompositeListLayoutIndexChange | undefined {
  if (!env.enableHistory) {
    return undefined;
  }
  return {
    kind: ChangeKind.ItemIndexChange,
    index,
    oldIndex,
    data: env.enableDataHistory ? data : undefined,
  };
}
