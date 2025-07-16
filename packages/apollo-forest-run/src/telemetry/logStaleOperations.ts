import type { Cache } from "@apollo/client";
import type { OperationDescriptor } from "../descriptor/types";
import type { CacheEnv, Transaction } from "../cache/types";
import type { UnexpectedRefetch } from "../telemetry/types";
import { isWrite } from "../cache/write";

export function logStaleOperations(
  env: CacheEnv,
  transaction: Transaction,
  stale: {
    operation: OperationDescriptor;
    diff: Cache.DiffResult<any>;
  }[],
) {
  if (!env.logStaleOperations || !transaction.changelog.length) {
    return;
  }
  const writes = transaction.changelog.filter((o) => isWrite(o));
  if (!writes.length) {
    // Custom cache.modify or cache.evict - expected to evict operations
    return;
  }
  const event: UnexpectedRefetch = {
    kind: "UNEXPECTED_REFETCH",
    causedBy: writes.map((write) => write.incoming.operation.debugName),
    affected: stale.map((op) => {
      const missingFieldPath = op.diff.missing?.[0]?.path;
      return [
        op.operation.debugName,
        Array.isArray(missingFieldPath)
          ? missingFieldPath.join(".")
          : "UNKNOWN_PATH",
      ];
    }),
  };
  env?.notify?.(event);

  env.logger?.warn(
    `Incoming Apollo operation led to missing fields in watched operations (triggering re-fetch)\n` +
      `  Incoming operation(s):\n` +
      event.causedBy.join("\n") +
      `\n` +
      `  Affected operation(s):\n` +
      event.affected.map((op) => `${op[0]} (${op[1]})`).join("\n"),
  );
}
