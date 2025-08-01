"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logStaleOperations = logStaleOperations;
const write_1 = require("../cache/write");
function logStaleOperations(env, transaction, stale) {
    if (!env.logStaleOperations || !transaction.changelog.length) {
        return;
    }
    const writes = transaction.changelog.filter((o) => (0, write_1.isWrite)(o));
    if (!writes.length) {
        // Custom cache.modify or cache.evict - expected to evict operations
        return;
    }
    const event = {
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
    env.logger?.warn(`Incoming Apollo operation led to missing fields in watched operations (triggering re-fetch)\n` +
        `  Incoming operation(s):\n` +
        event.causedBy.join("\n") +
        `\n` +
        `  Affected operation(s):\n` +
        event.affected.map((op) => `${op[0]} (${op[1]})`).join("\n"));
}
