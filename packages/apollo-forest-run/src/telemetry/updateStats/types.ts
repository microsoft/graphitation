import { TypeName } from "../../descriptor/types";

export type UpdateTreeStats = {
  operationName: string;
  updates: ChunkUpdateStats[];
} & CopyStats;

export type CopyStats = {
  arraysCopied: number;
  arrayItemsCopied: number;
  objectFieldsCopied: number;
  objectsCopied: number;
};

/**
 * @property nodeType - The type of the mutated node.
 * @property depth - The depth of the node in the tree.
 * @property fieldsMutated - Number of object fields changed in this mutation.
 * @property itemsMutated - Number of array items changed in this mutation.
 * @property updateStats - Detailed stats for this mutation, including fields/items mutated and copy stats.
 * @property parentUpdateStats - (Optional) Copy stats for changes propagated up to the root, if applicable.
 */
export type ChunkUpdateStats = {
  nodeType: TypeName;
  depth: number;
  updateStats: {
    fieldsMutated: number;
    itemsMutated: number;
  } & CopyStats;
  updateAscendantStats?: CopyStats;
};
