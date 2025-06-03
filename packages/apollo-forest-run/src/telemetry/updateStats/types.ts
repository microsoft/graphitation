import { ArrayIndex, FieldName, TypeName } from "../../descriptor/types";
import { CompositeValueChunk } from "../../values/types";

export type UpdateTreeStats = {
  arraysCopied: number;
  arrayItemsCopied: number;
  objectsCopied: number;
  objectFieldsCopied: number; // (chunk.selection.fields.size - chunk.selection.skippedFields.size)
  heaviestArrayCopy?: CopyStats;
  heaviestObjectCopy?: CopyStats;
  causedBy?: TypeName; // take it from differenceMap in updateTree
  mutations: MutationStats[];
};

type CopyStats = {
  nodeType: TypeName;
  path: (ArrayIndex | FieldName)[];
  size?: number; // length for array, count of fields for object
  depth: number;
};

export type MutationStats = {
  nodeType: TypeName;
  depth: number;
  fieldsMutated: number;
  itemsMutated: number;
};

export abstract class UpdateLoggerAbstract {
  abstract startMutation(nodeType: TypeName | false, depth: number): void;
  abstract finishMutation(): void;
  abstract copy(chunk: CompositeValueChunk): void;
  abstract fieldMutation(): void;
  abstract itemMutation(): void;
  abstract getStats(): UpdateTreeStats;
}
