import type { CacheEnv, Write } from "../cache/types";

export function logUpdateStats(env: CacheEnv, writes: Write[]) {
  const { logUpdateStats } = env;
  if (!logUpdateStats) {
    return;
  }

  writes.forEach((write) => {
    const { updateStats } = write;
    if (!updateStats || updateStats.size === 0) {
      return;
    }
    env.notify?.({
      type: "UPDATE_STATS",
      causedBy: write.tree.operation.debugName,
      updateStats,
    } as unknown as any);
  });
}
