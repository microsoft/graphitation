import type { CacheEnv, Write } from "../../cache/types";

export function logUpdateStats(
  env: CacheEnv,
  writes: Write[],
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
      causedBy: write.tree.operation.debugName,
      watchersCount: watchers.size,
      updateStats: updateStats as NonNullable<(typeof updateStats)[number]>[],
    });
  });
}
