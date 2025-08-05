"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toIterableValue = toIterableValue;
const types_1 = require("./types");
const resolve_1 = require("./resolve");
const assert_1 = require("../jsutils/assert");
function toIterableValue(list) {
    return { list, length: list.data.length, [Symbol.iterator]: iterator };
}
function iterator() {
    const list = this.list;
    const len = list.data.length;
    const next = { done: false, value: null };
    let i = 0;
    return {
        next() {
            var _a;
            if (i >= len) {
                next.done = true;
                return next;
            }
            const item = (0, resolve_1.aggregateListItemValue)(list, i++);
            if (item.kind === types_1.ValueKind.Object) {
                next.value = item;
                return next;
            }
            if (item.kind === types_1.ValueKind.CompositeList) {
                next.value = toIterableValue(item);
                return next;
            }
            if (item.kind === types_1.ValueKind.CompositeNull) {
                next.value = null;
                return next;
            }
            if (item.kind === types_1.ValueKind.CompositeUndefined) {
                const itemChunk = item.isAggregate ? item.chunks[0] : item;
                throw new Error(`Missing list item ${i - 1} in ${JSON.stringify(list)}\n` +
                    `  operation: ${(_a = itemChunk.operation.definition.name) === null || _a === void 0 ? void 0 : _a.value}`);
            }
            (0, assert_1.assertNever)(item);
        },
    };
}
