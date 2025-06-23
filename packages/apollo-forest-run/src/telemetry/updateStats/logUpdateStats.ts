import type { CacheEnv, WriteResult, ModifyResult } from "../../cache/types";
import { isWrite } from "../../cache/write";

export function logUpdateStats(
  env: CacheEnv,
  log: (WriteResult | ModifyResult)[],
  watchers: Set<unknown>,
) {
  if (!env.logUpdateStats) {
    return;
  }

  log.forEach((entry) => {
    if (!isWrite(entry) || !entry.updateStats?.length) {
      return;
    }
    env.notify?.({
      kind: "UPDATE_STATS",
      causedBy: entry.incoming.operation.debugName,
      watchersCount: watchers.size,
      updateStats: entry.updateStats as NonNullable<
        (typeof entry.updateStats)[number]
      >[],
    });
  });
}
