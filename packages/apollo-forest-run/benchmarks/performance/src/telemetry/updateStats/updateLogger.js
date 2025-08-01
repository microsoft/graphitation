"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateLogger = void 0;
exports.makeCopyStats = makeCopyStats;
exports.createUpdateLogger = createUpdateLogger;
const types_1 = require("../../values/types");
function increaseObjectStats(stats, copiedFields) {
    if (!stats) {
        return;
    }
    stats.objectsCopied++;
    stats.objectFieldsCopied += copiedFields;
}
function increaseArrayStats(stats, copiedItems) {
    if (!stats) {
        return;
    }
    stats.arraysCopied++;
    stats.arrayItemsCopied += copiedItems;
}
function makeCopyStats() {
    return {
        arraysCopied: 0,
        arrayItemsCopied: 0,
        objectFieldsCopied: 0,
        objectsCopied: 0,
    };
}
class UpdateLogger {
    constructor() {
        const stats = {
            objectsCopied: 0,
            objectFieldsCopied: 0,
            arraysCopied: 0,
            arrayItemsCopied: 0,
            operationName: "",
            updates: [],
        };
        this.stats = stats;
        this.currentUpdate = undefined;
    }
    copyParentChunkStats(chunk, draft) {
        const isDraft = !!draft;
        this.recordChunkCopy(chunk, this.currentUpdate?.updateAscendantStats, isDraft);
    }
    copyChunkStats(chunk, draft) {
        const isDraft = !!draft;
        this.recordChunkCopy(chunk, this.currentUpdate?.updateStats, isDraft);
    }
    recordChunkCopy(chunk, stats, isDraft = false) {
        switch (chunk.kind) {
            case types_1.ValueKind.Object: {
                this.recordObjectCopy(chunk, stats, isDraft);
                break;
            }
            case types_1.ValueKind.CompositeList: {
                this.recordArrayCopy(chunk, stats, isDraft);
                break;
            }
        }
    }
    recordObjectCopy(chunk, stats, isDraft) {
        const copiedFields = chunk.selection.fieldQueue.length;
        increaseObjectStats(stats, copiedFields);
        if (!isDraft) {
            increaseObjectStats(this.stats, copiedFields);
        }
    }
    recordArrayCopy(chunk, stats, isDraft) {
        const copiedItems = chunk.itemChunks.length;
        increaseArrayStats(stats, copiedItems);
        if (!isDraft) {
            increaseArrayStats(this.stats, copiedItems);
        }
    }
    startChunkUpdate(chunk) {
        this.currentUpdate = {
            nodeType: chunk.type || "UNKNOWN_OBJECT",
            depth: chunk.selection.depth,
            updateStats: {
                arraysCopied: 0,
                arrayItemsCopied: 0,
                objectFieldsCopied: 0,
                objectsCopied: 0,
                fieldsMutated: 0,
                itemsMutated: 0,
            },
            updateAscendantStats: makeCopyStats(),
        };
    }
    finishChunkUpdate() {
        if (!this.currentUpdate) {
            return;
        }
        this.stats.updates.push(this.currentUpdate);
        this.currentUpdate = undefined;
    }
    fieldMutation() {
        if (this.currentUpdate) {
            this.currentUpdate.updateStats.fieldsMutated++;
        }
    }
    itemMutation() {
        if (this.currentUpdate) {
            this.currentUpdate.updateStats.itemsMutated++;
        }
    }
    getStats(operationName) {
        this.stats.operationName = operationName;
        return this.stats;
    }
}
exports.UpdateLogger = UpdateLogger;
function createUpdateLogger(enabled = true) {
    return enabled ? new UpdateLogger() : undefined;
}
