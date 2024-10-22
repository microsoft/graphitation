export function accumulate<K, T>(
  accumulatorMap: Map<K, Array<T>>,
  key: K,
  item: T,
): void {
  const group = accumulatorMap.get(key);
  if (group === undefined) {
    accumulatorMap.set(key, [item]);
  } else {
    group.push(item);
  }
}

export function accumulateMany<K, T>(
  accumulatorMap: Map<K, Array<T>>,
  key: K,
  items: T[],
  copyOnInsert = true,
): void {
  const group = accumulatorMap.get(key);
  if (group === undefined) {
    accumulatorMap.set(key, copyOnInsert ? [...items] : items);
  } else {
    group.push(...items);
  }
}

export function deleteAccumulated<K, T>(
  accumulatorMap: Map<K, Array<T>>,
  key: K,
  deletedItem: T,
) {
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

export function getOrCreate<K, T>(map: Map<K, T>, key: K, factory: () => T): T {
  let value = map.get(key);
  if (value === undefined) {
    value = factory();
    map.set(key, value);
  }
  return value;
}
