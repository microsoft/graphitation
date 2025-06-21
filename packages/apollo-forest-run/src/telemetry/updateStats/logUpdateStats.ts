import type { CacheEnv, WriteResult } from "../../cache/types";

export function logUpdateStats(
  env: CacheEnv,
  writes: WriteResult[],
  watchers: Set<unknown>,
) {
  const { logUpdateStats } = env;

  writes.forEach((write) => {
    const { updateStats } = write;
    if (!logUpdateStats || !updateStats || updateStats.length === 0) {
      return;
    }

    env.notify?.({
      kind: "UPDATE_STATS",
      causedBy: write.incoming.operation.debugName,
      watchersCount: watchers.size,
      updateStats: updateStats as NonNullable<(typeof updateStats)[number]>[],
    });
  });
}
