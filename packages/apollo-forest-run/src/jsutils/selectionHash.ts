/**
 * Lightweight hash utilities for PossibleSelection structural hashing.
 * Uses FNV-1a-inspired mixing for combining string hashes and numbers.
 * Order-independent at the field level (uses commutative accumulation).
 */

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
      return hashString(val);
    case "number":
      return val | 0;
    case "boolean":
      return val ? 1 : 0;
    default: {
      if (Array.isArray(val)) {
        let h = 0xa5a5a5a5;
        for (let i = 0; i < val.length; i++) {
          h = combineHash(h, hashValue(val[i]));
        }
        return h;
      }
      // Object: sort keys for stability
      const obj = val as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      let h = 0x5a5a5a5a;
      for (const k of keys) {
        h = combineHash(h, hashString(k));
        h = combineHash(h, hashValue(obj[k]));
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
