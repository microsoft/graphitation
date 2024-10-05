import { CompositeListValue, ObjectValue, ValueKind } from "./types";
import { aggregateListItemValue } from "./resolve";
import { getDataPathForDebugging } from "./traverse";
import { assertNever } from "../jsutils/assert";

export type IterableListValue = {
  readonly list: CompositeListValue;
  readonly length: number;
  [Symbol.iterator](): Iterator<ObjectValue | null | IterableListValue>;
};

type NextResult = {
  done: boolean;
  value: ObjectValue | IterableListValue | null;
};

export function toIterableValue(list: CompositeListValue): IterableListValue {
  return { list, length: list.data.length, [Symbol.iterator]: iterator };
}

function iterator(
  this: IterableListValue,
): Iterator<ObjectValue | IterableListValue | null> {
  const list = this.list;
  const len = list.data.length;
  const next: NextResult = { done: false, value: null };
  let i = 0;
  return {
    next() {
      if (i >= len) {
        next.done = true;
        return next;
      }
      const item = aggregateListItemValue(list, i++);
      if (item.kind === ValueKind.Object) {
        next.value = item;
        return next;
      }
      if (item.kind === ValueKind.CompositeList) {
        next.value = toIterableValue(item);
        return next;
      }
      if (item.kind === ValueKind.CompositeNull) {
        next.value = null;
        return next;
      }
      if (item.kind === ValueKind.CompositeUndefined) {
        const itemChunk = item.isAggregate ? item.chunks[0] : item;
        throw new Error(
          `Missing list item ${i - 1} in ${JSON.stringify(list)}\n` +
            `  operation: ${itemChunk.operation.definition.name?.value}`,
        );
      }
      assertNever(item);
    },
  };
}
