/**
 * Lightweight hash utilities for PossibleSelection structural hashing.
 * Uses FNV-1a-inspired mixing for combining string hashes and numbers.
 * Order-independent at the field level (uses commutative accumulation).
 */

const TYPE_STRING = 1;
const TYPE_NUMBER = 2;
const TYPE_BOOLEAN = 3;
const TYPE_BIGINT = 4;

// Reusable buffers for reading float64 bits as two uint32 values
const f64Buf = new Float64Array(1);
const u32Buf = new Uint32Array(f64Buf.buffer);

export function hashString(s: string): number {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  return h >>> 0;
}

/** Order-dependent combination: mixes v into running hash h */
export function combineHash(h: number, v: number): number {
  // Use addition before multiply to avoid XOR self-cancellation (h ^ h = 0)
  h = (h + (v >>> 0) + 0x9e3779b9) | 0;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Hash any JS value in a key-order-independent way */
export function hashValue(val: unknown): number {
  if (val === null || val === undefined) return 0;
  switch (typeof val) {
    case "string":
      return combineHash(TYPE_STRING, hashString(val));
    case "number": {
      f64Buf[0] = val;
      return combineHash(TYPE_NUMBER, combineHash(u32Buf[0], u32Buf[1]));
    }
    case "boolean":
      return combineHash(TYPE_BOOLEAN, val ? 1 : 0);
    case "bigint": {
      const n = Number(val);
      f64Buf[0] = n;
      return combineHash(TYPE_BIGINT, combineHash(u32Buf[0], u32Buf[1]));
    }
    default: {
      if (Array.isArray(val)) {
        let h = 0xa5a5a5a5;
        for (let i = 0; i < val.length; i++) {
          h = combineHash(h, hashValue(val[i]));
        }
        return h;
      }
      // Objects with numeric valueOf (e.g. Date) — hash by primitive value
      if (
        typeof (val as { valueOf?: unknown }).valueOf === "function" &&
        (val as { valueOf: () => unknown }).valueOf !== Object.prototype.valueOf
      ) {
        const prim = (val as { valueOf: () => unknown }).valueOf();
        if (typeof prim === "number" || typeof prim === "string") {
          return hashValue(prim);
        }
      }
      // Object: order-independent accumulation (no sort needed)
      const obj = val as Record<string, unknown>;
      let h = 0x5a5a5a5a;
      for (const k of Object.keys(obj)) {
        h = accumulateHash(h, combineHash(hashString(k), hashValue(obj[k])));
      }
      return h;
    }
  }
}

/** Order-independent accumulation (commutative: result doesn't depend on order) */
export function accumulateHash(acc: number, v: number): number {
  // Mix v independently then XOR into accumulator
  let h = (v + 0x9e3779b9) | 0;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (acc ^ h) >>> 0;
}
