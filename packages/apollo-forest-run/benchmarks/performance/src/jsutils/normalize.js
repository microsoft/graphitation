"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortKeys = sortKeys;
function sortKeys(value) {
    if (typeof value !== "object" || value === null) {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((test) => sortKeys(test));
    }
    return Object.fromEntries(Object.entries(value)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, value]) => [key, sortKeys(value)]));
}
