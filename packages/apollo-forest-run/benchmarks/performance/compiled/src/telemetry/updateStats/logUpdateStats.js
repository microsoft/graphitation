"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logUpdateStats = logUpdateStats;
const write_1 = require("../../cache/write");
function logUpdateStats(env, log, watchers) {
    if (!env.logUpdateStats) {
        return;
    }
    log.forEach((entry) => {
        var _a, _b;
        if (!(0, write_1.isWrite)(entry) || !((_a = entry.updateStats) === null || _a === void 0 ? void 0 : _a.length)) {
            return;
        }
        (_b = env.notify) === null || _b === void 0 ? void 0 : _b.call(env, {
            kind: "UPDATE_STATS",
            causedBy: entry.incoming.operation.debugName,
            watchersCount: watchers.size,
            updateStats: entry.updateStats,
        });
    });
}
