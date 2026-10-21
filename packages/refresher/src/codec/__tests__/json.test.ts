import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDeepStrictEqual } from "node:util";
import * as fc from "fast-check";
import type {
  AccessConfig,
  Action,
  AnyView,
  JsonCodecOptions,
  View,
  ViewId,
} from "../../index";
import { createJsonCodec } from "../json";
import { describeCodecContract } from "./contract";

const view: View<unknown, unknown, AccessConfig> = { name: "Test" };

/** Decodes base64url, padded or not, as UTF-8. */
function fromBase64url(key: string): string {
  const binary = atob(key.replaceAll("-", "+").replaceAll("_", "/"));
  return new TextDecoder().decode(
    Uint8Array.from(binary, (char) => char.charCodeAt(0)),
  );
}

/**
 * A model of argument identity over JSON: objects are sorted entry lists without
 * `undefined` properties, `-0` is `0`, a Date is its ISO string, and `undefined`
 * arguments are none at all.
 * Two arguments share an identity exactly when their models are deeply equal.
 */
function model(value: unknown): unknown {
  if (value === undefined) return ["none"];
  if (value === null || typeof value !== "object")
    return Object.is(value, -0) ? 0 : value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return ["array", Array.from(value, model)];
  const entries = Object.entries(value)
    .filter(([, child]) => child !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, child]: [string, unknown]) => [key, model(child)]);
  return ["object", entries];
}

/** Recreates `value` with object keys in reverse order. */
function reordered(value: unknown): unknown {
  if (value === null || typeof value !== "object" || value instanceof Date)
    return value;
  if (Array.isArray(value)) return value.map(reordered);
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, child]: [string, unknown]) => [key, reordered(child)]),
  );
}

/** Adds an element to every array and a property to every plain object in `value`. */
function mutate(value: unknown): void {
  if (value === null || typeof value !== "object" || value instanceof Date)
    return;
  if (Array.isArray(value)) {
    for (const child of value) mutate(child);
    value.push("added");
    return;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) mutate(record[key]);
  record["added"] = 1;
}

// Small domains so that independently drawn arguments often collide; binary strings
// reach multi-byte UTF-8 and lone surrogates.
const { json } = fc.letrec((tie) => ({
  json: fc.oneof(
    { depthSize: "small" },
    fc.constantFrom(
      "a",
      "1",
      "null",
      "",
      "é",
      "😀",
      0,
      -0,
      1,
      1.5,
      true,
      false,
      null,
    ),
    fc.string({ unit: "binary", maxLength: 3 }),
    fc.date({ noInvalidDate: true, min: new Date(-1), max: new Date(1) }),
    fc.date({ noInvalidDate: true }),
    fc.array(tie("json"), { maxLength: 3 }),
    fc.dictionary(
      fc.constantFrom("a", "b", "__proto__", "$ref", "$$typeof", "é"),
      fc.option(tie("json"), { nil: undefined }),
      { maxKeys: 3, noNullPrototype: false },
    ),
  ),
}));
const args = fc.option(json, { nil: undefined, freq: 8 });

const ref = Object.freeze({
  $$typeof: Symbol.for("refresher.ref"),
  view: "Test",
  args: 1,
});

/** Arguments, and some the codec rejects. */
const anyArgs = fc.oneof(
  { weight: 8, arbitrary: args },
  fc.constantFrom(Number.NaN, 1n, ref, [undefined]),
  fc.constant(null).map(() => new Map()),
);

/** Ids, names, and ids that look like the local ids the codec issues. */
const views: fc.Arbitrary<AnyView> = fc.record(
  {
    id: fc.oneof(
      fc.string({ maxLength: 3 }),
      fc.constantFrom("__1", "__2", "__a_1", "__a_2"),
    ),
    name: fc.oneof(fc.string({ maxLength: 3 }), fc.constant("a")),
  },
  { requiredKeys: [] },
);

/** Distinct actions, functions and objects, often with the same name or none. */
const actions: fc.Arbitrary<Action> = fc.oneof(
  fc
    .constantFrom("", "a", "__1", "send")
    .map(
      (name): Action =>
        Object.defineProperty((arg: unknown) => arg, "name", { value: name }),
    ),
  fc.option(fc.constantFrom("a", "send"), { nil: undefined }).map(command),
);

/** A command object, an action that is not a function. */
function command(name: string | undefined): Action {
  const made: { readonly type: string; name?: string } = { type: "command" };
  if (name !== undefined) made.name = name;
  return made;
}

function assertArgumentError(
  action: () => unknown,
  path?: readonly (string | number)[],
): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(Reflect.get(error, "kind"), "value");
    assert.equal(Reflect.get(error, "code"), "INVALID_ARGUMENT");
    if (path !== undefined) assert.deepEqual(Reflect.get(error, "path"), path);
    return true;
  });
}

/** Whether every array and plain object in `value` is frozen. */
function deeplyFrozen(value: unknown): boolean {
  if (value === null || typeof value !== "object" || value instanceof Date)
    return true;
  return Object.isFrozen(value) && Object.values(value).every(deeplyFrozen);
}

const variants: readonly (readonly [string, JsonCodecOptions | undefined])[] = [
  ["default options", undefined],
  ["base64 keys", { base64Keys: true }],
  ["JSON keys", { base64Keys: false }],
  ["frozen arguments", { freezeArgs: true }],
  ["frozen arguments and base64 keys", { freezeArgs: true, base64Keys: true }],
];

for (const [name, options] of variants) {
  describeCodecContract({
    name: `JSON codec with ${name}`,
    create: () => createJsonCodec(options),
    views,
    args: anyArgs,
    sameArgs: (_view, a, b) => isDeepStrictEqual(model(a), model(b)),
    actions,
    sameActionArgs: (_action, a, b) => isDeepStrictEqual(model(a), model(b)),
  });

  const codec = createJsonCodec(options);
  const argsKey = (value: unknown): string => codec.argsKey(view, value);

  describe(`JSON codec with ${name}`, () => {
    it("is frozen and captures results by identity", () => {
      assert.ok(Object.isFrozen(codec));
      fc.assert(
        fc.property(fc.anything(), (value) => {
          assert.equal(codec.captureResult(view, value), value);
        }),
      );
    });

    it("captures arguments as passed, frozen when asked", () => {
      const freezes = options?.freezeArgs === true;
      fc.assert(
        fc.property(args, (value) => {
          const key = argsKey(value);
          const captured = codec.captureArgs(view, value);
          assert.equal(captured, value);
          assert.equal(argsKey(captured), key);
          if (
            typeof value === "object" &&
            value !== null &&
            !(value instanceof Date)
          ) {
            assert.equal(deeplyFrozen(value), freezes);
            if (freezes) assert.throws(() => mutate(value), TypeError);
            else mutate(value);
            assert.equal(argsKey(captured) === key, freezes);
          }
        }),
      );
    });

    it("leaves Dates and other non-plain objects inside arguments unfrozen", () => {
      const map = new Map();
      const date = new Date(0);
      codec.captureArgs(view, { map, date, ref, list: [map] });
      assert.equal(Object.isFrozen(map), false);
      assert.equal(Object.isFrozen(date), false);
    });

    it("keys a Date as its ISO string", () => {
      fc.assert(
        fc.property(fc.date({ noInvalidDate: true }), (date) => {
          assert.equal(
            argsKey({ at: date }),
            argsKey({ at: date.toISOString() }),
          );
          assert.equal(argsKey([date]), argsKey([new Date(date.getTime())]));
        }),
      );
    });

    it("writes the empty key exactly for undefined arguments", () => {
      fc.assert(
        fc.property(args, (value) => {
          assert.equal(argsKey(value) === "", value === undefined);
        }),
      );
    });

    it("does not depend on property order", () => {
      fc.assert(
        fc.property(args, (value) => {
          assert.equal(argsKey(reordered(value)), argsKey(value));
        }),
      );
    });

    it("rejects anything but JSON at its path", () => {
      class Point {
        x = 1;
      }
      const unsupported = [
        new Map(),
        new Set(),
        new Date(Number.NaN),
        new Point(),
        new Uint8Array(1),
        ref,
        () => 1,
        Symbol("s"),
        1n,
        Number.NaN,
        Infinity,
      ];
      for (const value of unsupported) {
        assertArgumentError(() => argsKey(value), []);
        assertArgumentError(() => argsKey({ a: [1, value] }), ["a", 1]);
      }
      assertArgumentError(() => argsKey([1, undefined]), [1]);
    });

    it("rejects cyclic arguments", () => {
      const cycle: Record<string, unknown> = {};
      cycle["self"] = cycle;
      assertArgumentError(() => argsKey(cycle));
      const list: unknown[] = [];
      list.push({ list });
      assertArgumentError(() => argsKey(list));
    });
  });
}

describe("JSON codec key encodings", () => {
  const base64 = createJsonCodec({ base64Keys: true });
  const plain = createJsonCodec();

  it("writes base64url keys, without padding, of the JSON key", () => {
    fc.assert(
      fc.property(args, (value) => {
        const key = base64.argsKey(view, value);
        assert.match(key, /^[\w-]*$/);
        assert.equal(fromBase64url(key), plain.argsKey(view, value));
      }),
    );
  });

  it("writes JSON keys that parse back to the arguments' model", () => {
    fc.assert(
      fc.property(json, (value) => {
        const parsed: unknown = JSON.parse(plain.argsKey(view, value));
        assert.ok(isDeepStrictEqual(model(parsed), model(value)));
      }),
    );
  });

  it("handles long and non-ASCII keys", () => {
    const value = {
      text: "😀".repeat(5000),
      list: Array.from({ length: 2000 }, (_, i) => i),
    };
    const key = base64.argsKey(view, value);
    assert.equal(fromBase64url(key), plain.argsKey(view, value));
    assert.equal(base64.argsKey(view, { a: 1 }), "eyJhIjoxfQ");
  });
});

/**
 * A model of how the JSON codec names views: a view with an `id` goes by it, unless
 * another view already does, and any other view by a fresh id that starts with `__` and
 * includes its `name`. Returns whether `named`, the codec's answer, fits.
 */
function jsonNamingModel() {
  const idOf = new Map<AnyView, ViewId>();
  const taken = new Set<ViewId>();
  return {
    check(target: AnyView, named: string): void {
      const known = idOf.get(target);
      if (known !== undefined) {
        assert.equal(named, known);
        return;
      }
      if (target.id !== undefined && taken.has(target.id)) {
        assert.equal(named, "DUPLICATE_VIEW");
        return;
      }
      if (target.id === undefined) {
        assert.ok(named.startsWith("__") && named.includes(target.name ?? ""));
        assert.ok(!taken.has(named));
      } else {
        assert.equal(named, target.id);
      }
      idOf.set(target, named);
      taken.add(named);
    },
  };
}

function keyOrCode(action: () => string): string {
  try {
    return action();
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.equal(Reflect.get(error, "kind"), "view");
    return String(Reflect.get(error, "code"));
  }
}

function assertViewError(action: () => unknown, code: string): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(Reflect.get(error, "kind"), "view");
    assert.equal(Reflect.get(error, "code"), code);
    return true;
  });
}

describe("JSON codec view keys", () => {
  it("names a view by its id unless another view goes by it, and others by their name", () => {
    fc.assert(
      fc.property(
        fc.array(views, { minLength: 1, maxLength: 6 }),
        fc.array(fc.nat(), { maxLength: 20 }),
        (targets, calls) => {
          const codec = createJsonCodec();
          const naming = jsonNamingModel();
          for (const call of [...calls, ...targets.keys()]) {
            const target = targets[call % targets.length];
            assert.ok(target);
            naming.check(
              target,
              keyOrCode(() => codec.viewKey(target)),
            );
          }
        },
      ),
    );
  });

  it("accepts ids in any format and rejects an id another view goes by", () => {
    for (const id of ["", "1a", "a-b", "a:b", "__a", "__"]) {
      assert.equal(createJsonCodec().viewKey({ id }), id);
    }
    const codec = createJsonCodec();
    const first: AnyView = { id: "A" };
    assert.equal(codec.viewKey(first), "A");
    assert.equal(codec.viewKey(first), "A");
    assertViewError(() => codec.viewKey({ id: "A" }), "DUPLICATE_VIEW");
  });
});

describe("JSON codec action keys", () => {
  it("names every action by a fresh local id that includes its name", () => {
    fc.assert(
      fc.property(
        fc.array(actions, { minLength: 1, maxLength: 6 }),
        (targets) => {
          const codec = createJsonCodec();
          const named = new Set<string>();
          for (const target of targets) {
            const id = codec.actionKey(target);
            assert.ok(id.startsWith("__") && id.includes(target.name ?? ""));
            assert.ok(!named.has(id));
            named.add(id);
            assert.equal(codec.actionKey(target), id);
          }
        },
      ),
    );
  });

  it("keys action arguments as it keys view arguments", () => {
    fc.assert(
      fc.property(actions, anyArgs, (target, value) => {
        const codec = createJsonCodec();
        const viewKey = keyOrError(() => codec.argsKey(view, value));
        assert.equal(
          keyOrError(() => codec.actionArgsKey(target, value)),
          viewKey,
        );
      }),
    );
  });
});

function keyOrError(action: () => string): string {
  try {
    return action();
  } catch (error) {
    assert.ok(error instanceof Error);
    return `${String(Reflect.get(error, "kind"))}:${String(
      Reflect.get(error, "code"),
    )}`;
  }
}
