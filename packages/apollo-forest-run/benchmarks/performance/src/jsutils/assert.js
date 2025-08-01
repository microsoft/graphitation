"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assert = assert;
exports.assertNever = assertNever;
function assert(condition, message = "") {
    if (!condition) {
        throw new Error("Invariant violation" + (message ? `: ${message}` : ""));
    }
}
function assertNever(...values) {
    throw new Error(`Unexpected member of typed union: \n` + JSON.stringify(values));
}
