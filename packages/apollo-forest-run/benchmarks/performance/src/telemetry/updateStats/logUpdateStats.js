"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logUpdateStats = logUpdateStats;
const write_1 = require("../../cache/write");
function logUpdateStats(env, log, watchers) {
    if (!env.logUpdateStats) {
        return;
    }
    log.forEach((entry) => {
        if (!(0, write_1.isWrite)(entry) || !entry.updateStats?.length) {
            return;
        }
        env.notify?.({
            kind: "UPDATE_STATS",
            causedBy: entry.incoming.operation.debugName,
            watchersCount: watchers.size,
            updateStats: entry.updateStats,
        });
    });
}
