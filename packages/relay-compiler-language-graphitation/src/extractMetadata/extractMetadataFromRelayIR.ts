import { ReaderFragment } from "relay-runtime/lib/util/ReaderNode";
import { Metadata } from "../types";

export function extractMetadataFromRelayIR(
  definition: ReaderFragment
): Metadata {
  const connection = definition.metadata?.refetch?.connection;
  if (connection) {
    return { connection };
  } else {
    return {};
  }
}
