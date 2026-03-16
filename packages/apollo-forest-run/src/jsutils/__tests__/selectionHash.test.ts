import {
  hashString,
  combineHash,
  hashValue,
  accumulateHash,
} from "../selectionHash";

describe("hashString", () => {
  test("returns consistent hash for same input", () => {
    expect(hashString("foo")).toBe(hashString("foo"));
  });

  test("returns different hashes for different strings", () => {
    expect(hashString("foo")).not.toBe(hashString("bar"));
  });

  test("returns unsigned 32-bit integer", () => {
    const h = hashString("test");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  test("handles empty string", () => {
    const h = hashString("");
    expect(h).toBe(0x811c9dc5); // FNV offset basis unchanged
  });
});

describe("combineHash", () => {
  test("returns unsigned 32-bit integer", () => {
    const h = combineHash(0, 42);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  test("different inputs produce different results", () => {
    expect(combineHash(0, 1)).not.toBe(combineHash(0, 2));
  });

  test("is order-dependent", () => {
    const a = combineHash(combineHash(0, 1), 2);
    const b = combineHash(combineHash(0, 2), 1);
    expect(a).not.toBe(b);
  });

  test("avoids self-cancellation (h combined with h is not 0)", () => {
    const h = 12345;
    expect(combineHash(h, h)).not.toBe(0);
  });
});

describe("accumulateHash", () => {
  test("is commutative (order-independent)", () => {
    const a = accumulateHash(accumulateHash(0, 1), 2);
    const b = accumulateHash(accumulateHash(0, 2), 1);
    expect(a).toBe(b);
  });

  test("returns unsigned 32-bit integer", () => {
    const h = accumulateHash(0, 99);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });

  test("different values produce different results", () => {
    expect(accumulateHash(0, 1)).not.toBe(accumulateHash(0, 2));
  });
});

describe("hashValue", () => {
  test("null returns 0", () => {
    expect(hashValue(null)).toBe(0);
  });

  test("undefined returns 0", () => {
    expect(hashValue(undefined)).toBe(0);
  });

  test("string is consistent", () => {
    expect(hashValue("foo")).toBe(hashValue("foo"));
  });

  test("different floats produce different hashes", () => {
    expect(hashValue(3.1)).not.toBe(hashValue(3.9));
    expect(hashValue(3.0)).not.toBe(hashValue(3.1));
  });

  test("number is consistent", () => {
    expect(hashValue(42)).toBe(hashValue(42));
    expect(hashValue(3.14)).toBe(hashValue(3.14));
  });

  test("boolean is consistent", () => {
    expect(hashValue(true)).toBe(hashValue(true));
    expect(hashValue(false)).toBe(hashValue(false));
  });

  test("number and boolean do not collide", () => {
    expect(hashValue(1)).not.toBe(hashValue(true));
    expect(hashValue(0)).not.toBe(hashValue(false));
  });

  test("number and string do not collide", () => {
    expect(hashValue(0)).not.toBe(hashValue("0"));
  });

  test("bigint is consistent", () => {
    expect(hashValue(BigInt(42))).toBe(hashValue(BigInt(42)));
  });

  test("different bigints produce different hashes", () => {
    expect(hashValue(BigInt(1))).not.toBe(hashValue(BigInt(2)));
  });

  test("bigint and number do not collide", () => {
    expect(hashValue(BigInt(1))).not.toBe(hashValue(1));
  });

  test("arrays are order-dependent", () => {
    expect(hashValue([1, 2, 3])).toBe(hashValue([1, 2, 3]));
    expect(hashValue([1, 2, 3])).not.toBe(hashValue([3, 2, 1]));
  });

  test("empty array returns consistent seed", () => {
    expect(hashValue([])).toBe(0xa5a5a5a5);
  });

  test("objects are key-order-independent", () => {
    expect(hashValue({ a: 1, b: 2 })).toBe(hashValue({ b: 2, a: 1 }));
  });

  test("objects with different values produce different hashes", () => {
    expect(hashValue({ a: 1 })).not.toBe(hashValue({ a: 2 }));
  });

  test("objects with different keys produce different hashes", () => {
    expect(hashValue({ a: 1 })).not.toBe(hashValue({ b: 1 }));
  });

  test("empty object returns consistent seed", () => {
    expect(hashValue({})).toBe(0x5a5a5a5a);
  });

  test("nested objects hash consistently", () => {
    const val = { a: { b: [1, "x"] }, c: true };
    expect(hashValue(val)).toBe(hashValue({ c: true, a: { b: [1, "x"] } }));
  });

  test("Date is consistent", () => {
    const d = new Date("2024-01-01T00:00:00Z");
    expect(hashValue(d)).toBe(hashValue(new Date("2024-01-01T00:00:00Z")));
  });

  test("different Dates produce different hashes", () => {
    const a = new Date("2024-01-01T00:00:00Z");
    const b = new Date("2024-06-15T12:00:00Z");
    expect(hashValue(a)).not.toBe(hashValue(b));
  });

  test("Date does not collide with empty object", () => {
    expect(hashValue(new Date("2024-01-01"))).not.toBe(hashValue({}));
  });

  test("custom valueOf object hashes by primitive", () => {
    const a = { valueOf: () => 42 };
    const b = { valueOf: () => 99 };
    expect(hashValue(a)).not.toBe(hashValue(b));
    expect(hashValue(a)).toBe(hashValue({ valueOf: () => 42 }));
  });

  test("plain object ignores default valueOf", () => {
    // Plain objects should still hash by keys, not valueOf
    expect(hashValue({ x: 1 })).not.toBe(hashValue({ y: 1 }));
  });
});
