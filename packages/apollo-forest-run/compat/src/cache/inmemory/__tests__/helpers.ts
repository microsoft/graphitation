import {
  NormalizedCache,
  NormalizedCacheObject,
  DiffQueryAgainstStoreOptions,
} from "../types";
import { EntityStore } from "../entityStore";
import { InMemoryCache } from "../inMemoryCache";
import { StoreReader } from "../readFromStore";
import { StoreWriter } from "../writeToStore";
import { Cache } from "../../../core";

export function defaultNormalizedCacheFactory(
  seed?: NormalizedCacheObject,
): NormalizedCache {
  const cache = new InMemoryCache();
  if (seed) {
    cache.restore(seed);
  }
  const store = new EntityStore.Root({
    policies: cache.policies,
    resultCaching: true,
  });
  assignStoreCache(store, cache);
  (store as any).__seed = seed;
  return store;
}

export function assignStoreCache(store: EntityStore, cache: InMemoryCache) {
  if (store.__seed) {
    cache.restore(store.__seed);
  }
  store.toObject = () => {
    const { __META, ...rest } = cache.extract();
    return rest;
  };
  store.lookup = (key) => {
    return cache.__lookup(key);
  };
  store.modify = () => {
    throw new Error("NOPE");
  };
  store.merge = () => {
    throw new Error("NOPE");
  };
  store.delete = () => {
    throw new Error("NOPE");
  };
  store.clear = () => {
    throw new Error("NOPE");
  };
  store.replace = () => {
    throw new Error("NOPE");
  };
}

interface WriteQueryToStoreOptions extends Cache.WriteOptions {
  writer: StoreWriter;
  store?: NormalizedCache;
}

export function readQueryFromStore<T = any>(
  reader: StoreReader,
  options: DiffQueryAgainstStoreOptions,
) {
  return reader.diffQueryAgainstStore<T>({
    ...options,
    returnPartialData: false,
  }).result;
}

export function writeQueryToStore(
  options: WriteQueryToStoreOptions,
): NormalizedCache {
  const {
    dataId = "ROOT_QUERY",
    store = new EntityStore.Root({
      policies: options.writer.cache.policies,
    }),
    ...writeOptions
  } = options;
  options.writer.writeToStore(store, {
    ...writeOptions,
    dataId,
  });
  return store;
}

export function withError(func: Function, regex?: RegExp) {
  let message: string = null as never;
  const { error } = console;
  console.error = (m: any) => {
    message = m;
  };

  try {
    const result = func();
    if (regex) {
      expect(message).toMatch(regex);
    }
    return result;
  } finally {
    console.error = error;
  }
}

describe("defaultNormalizedCacheFactory", function () {
  it("should return an EntityStore", function () {
    const store = defaultNormalizedCacheFactory();
    expect(store).toBeInstanceOf(EntityStore);
    expect(store).toBeInstanceOf(EntityStore.Root);
  });
});
