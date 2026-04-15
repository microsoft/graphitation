import { assert } from "./assert";

export interface MapLike<K, V> extends Iterable<[K, V]> {
  get(key: K): V | undefined;
  set(key: K, value: V): this;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  size: number;
}

/**
 * LRU implementation of algorithm from https://github.com/dominictarr/hashlru#algorithm using a Map
 */
export function createLRUMap<K, V>(
  recentItemsMax: number,
  onEvict: (key: K, value: V) => void,
): MapLike<K, V> {
  assert(recentItemsMax > 0);

  let newSpaceSize = 0;
  let newSpace = new Map<K, V>();
  let oldSpace = new Map<K, V>();

  const add = (key: K, value: V) => {
    newSpace.set(key, value);
    newSpaceSize++;

    if (newSpaceSize >= recentItemsMax) {
      const evicted = oldSpace;
      oldSpace = newSpace;
      newSpace = new Map<K, V>();
      newSpaceSize = 0;

      for (const [key, item] of evicted) {
        onEvict(key, item);
      }
    }
  };

  const result: MapLike<K, V> = {
    has: (key) => newSpace.has(key) || oldSpace.has(key),
    get(key) {
      if (newSpace.has(key)) {
        return newSpace.get(key) as V;
      }
      if (oldSpace.has(key)) {
        const value = oldSpace.get(key) as V;
        oldSpace.delete(key);
        add(key, value);
        return value;
      }
    },
    set(key, value) {
      if (newSpace.has(key)) {
        newSpace.set(key, value);
      } else {
        add(key, value);
      }
      return result;
    },
    delete(key) {
      const deleted = newSpace.delete(key);
      if (deleted) {
        newSpaceSize--;
      }
      return oldSpace.delete(key) || deleted;
    },
    clear() {
      newSpaceSize = 0;
      newSpace.clear();
      oldSpace.clear();
    },
    get size() {
      let oldSpaceSize = 0;
      for (const key of oldSpace.keys()) {
        if (!newSpace.has(key)) {
          oldSpaceSize++;
        }
      }
      return newSpaceSize + oldSpaceSize;
    },
    [Symbol.iterator](): Iterator<[K, V]> {
      let oldIter: Iterator<[K, V]> | null = oldSpace[Symbol.iterator]();
      let newIter: Iterator<[K, V]> | null = null;
      return {
        next(): IteratorResult<[K, V]> {
          if (oldIter) {
            for (;;) {
              const result = oldIter.next();
              if (result.done) {
                oldIter = null;
                newIter = newSpace[Symbol.iterator]();
                break;
              }
              if (!newSpace.has(result.value[0])) {
                return result;
              }
            }
          }
          return newIter!.next();
        },
      };
    },
  };
  return result;
}
