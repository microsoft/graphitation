import { TypeName } from "../../descriptor/types";

export type UpdateTreeStats =
  | {
      arraysCopied: number;
      arrayItemsCopied: number;
      objectsCopied: number;
      objectFieldsCopied: number;
      heaviestArrayCopy?: CopyStats;
      heaviestObjectCopy?: CopyStats;
      causedBy?: TypeName;
      mutations: MutationStats[];
    }
  | Record<string, never>;

type CopyStats = {
  nodeType: TypeName;
  size: number;
  depth: number;
};

export type MutationStats = {
  nodeType: TypeName;
  depth: number;
  fieldsMutated: number;
  itemsMutated: number;
};
