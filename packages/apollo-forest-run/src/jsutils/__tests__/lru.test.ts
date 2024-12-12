import { createLRUMap } from "../lru";

const evicted: unknown[] = [];
const testHelper = (maxSize: number) =>
  createLRUMap(maxSize, (...args) => {
    evicted.push(args);
  });

beforeEach(() => {
  evicted.length = 0;
});

test("set", () => {
  const lru = testHelper(2);
  lru.set("foo", "foo");

  expect(lru.get("foo")).toEqual("foo");
  expect(lru.has("foo")).toBe(true);
  expect(lru.has("bar")).toBe(false);
  expect(lru.size).toBe(1);
  expect(evicted.length).toBe(0);
});

test("update", () => {
  const lru = testHelper(2);
  lru.set("foo", "foo");
  lru.set("foo", "bar");

  expect(lru.get("foo")).toEqual("bar");
  expect(lru.size).toBe(1);
  expect([...lru]).toEqual([["foo", "bar"]]);
  expect(evicted.length).toBe(0);
});

test("moving to old space", () => {
  const lru = testHelper(2);
  lru.set("foo", "foo");
  lru.set("foo", "foo2");
  lru.set("bar", "bar");

  expect([...lru]).toEqual([
    ["foo", "foo2"],
    ["bar", "bar"],
  ]);
  expect(lru.size).toBe(2);
  expect(evicted.length).toBe(0);
});

test("evict", () => {
  const lru = testHelper(2);
  lru.set("evict1", "evict1");
  lru.set("evict2", "evict2");
  lru.set("foo", "foo");
  lru.set("bar", "bar");

  expect(lru.size).toBe(2);
  expect([...lru]).toEqual([
    ["foo", "foo"],
    ["bar", "bar"],
  ]);
  expect(evicted).toEqual([
    ["evict1", "evict1"],
    ["evict2", "evict2"],
  ]);
});

test("delete from new space", () => {
  const lru = testHelper(2);
  lru.set("foo", "foo");
  lru.set("bar", "bar");
  lru.set("baz", "baz");

  lru.delete("baz");

  expect(lru.has("baz")).toBe(false);
  expect(lru.size).toBe(2);
  expect([...lru]).toEqual([
    ["foo", "foo"],
    ["bar", "bar"],
  ]);
});

test("delete from old space", () => {
  const lru = testHelper(2);
  lru.set("foo", "foo");
  lru.set("bar", "bar");
  lru.set("baz", "baz");

  lru.delete("foo");

  expect(lru.has("foo")).toBe(false);
  expect(lru.size).toBe(2);
  expect([...lru]).toEqual([
    ["bar", "bar"],
    ["baz", "baz"],
  ]);
});

test("clear", () => {
  const lru = testHelper(2);
  lru.set("foo", "foo");
  lru.set("bar", "bar");
  lru.set("baz", "baz");

  lru.clear();

  expect(lru.size).toBe(0);
  expect([...lru]).toEqual([]);
});
