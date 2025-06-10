import { UpdateForestStats } from "../forest/types";

// IMPORTANT!
// 1. Events MUST NOT include any user data or any other information that can be used to identify a user.
//    This is necessary to comply with GDPR and other privacy regulations.
//    Events could be sent to the server and may be stored in logs or other storage.

// 2. Events MUST be serializable with JSON.stringify.
type OperationDebugName = string;
type FirstMissingFieldMessage = string;

// Event occurs when incoming write causes missing fields in watched operations.
// This happens due to a mismatching selection in the incoming operation and the affected operation.
//
// There are several situations when this can happen:
// - Incoming operation adds a new list item, but affected operation has some field in the selection
//     which is not present in the incoming operation, so it is impossible to complete the new array item.
//
// - Incoming operation switches field value of abstract type from one specific type to anoter (i.e. "__typename" changes),
//     but selection for another type of the affected operation contains fields in selection
//     which are not present in the incoming operation, so it is impossible to complete the object.
//
// - Incoming operation changes relationship between objects (i.e. changes value of some field
//   from object with id "A" to object with id "B"), but affected operation has fields in selection
//     which are not present in the incoming operation,
//
export type UnexpectedRefetch = {
  kind: "UNEXPECTED_REFETCH";
  causedBy: OperationDebugName[];
  affected: Array<[OperationDebugName, FirstMissingFieldMessage]>;
};

// Event occurs when read policy throws an error
export type ReadPolicyError = {
  kind: "READ_POLICY_ERROR";
  op: OperationDebugName;
  type: string;
  field: string;
};

// Event occurs when merge policy throws an error
export type MergePolicyError = {
  kind: "MERGE_POLICY_ERROR";
  op: OperationDebugName;
  type: string;
  field: string;
};

// Event occurs when merge policy throws an error
export type UpdateStats = {
  kind: "UPDATE_STATS";
  causedBy: OperationDebugName;
  updateStats: UpdateForestStats;
};

export type TelemetryEvent =
  | UnexpectedRefetch
  | UpdateStats
  | ReadPolicyError
  | MergePolicyError;
