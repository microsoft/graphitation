"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accumulate = accumulate;
exports.accumulateMany = accumulateMany;
exports.deleteAccumulated = deleteAccumulated;
exports.getOrCreate = getOrCreate;
function accumulate(accumulatorMap, key, item) {
    const group = accumulatorMap.get(key);
    if (group === undefined) {
        accumulatorMap.set(key, [item]);
    }
    else {
        group.push(item);
    }
}
function accumulateMany(accumulatorMap, key, items, copyOnInsert = true) {
    const group = accumulatorMap.get(key);
    if (group === undefined) {
        accumulatorMap.set(key, copyOnInsert ? [...items] : items);
    }
    else {
        group.push(...items);
    }
}
function deleteAccumulated(accumulatorMap, key, deletedItem) {
    const group = accumulatorMap.get(key);
    if (!group) {
        return;
    }
    const index = group.findIndex((item) => item === deletedItem);
    if (index !== -1) {
        group.splice(index, 1);
    }
    if (!group.length) {
        accumulatorMap.delete(key);
    }
}
function getOrCreate(map, key, factory) {
    let value = map.get(key);
    if (value === undefined) {
        value = factory();
        map.set(key, value);
    }
    return value;
}
