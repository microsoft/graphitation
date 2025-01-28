export function sortKeys<T>(value: T): T {
  if (typeof value !== "object" || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((test) => sortKeys(test)) as T;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => [key, sortKeys(value)]),
  ) as T;
}
