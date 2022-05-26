export type CacheObjectWithSize = {
  key: string;
  value: Record<string, unknown>;
  valueSize: number | null;
};
