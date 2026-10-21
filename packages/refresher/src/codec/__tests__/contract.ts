import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as fc from "fast-check";
import type { Action, ActionId, AnyRef, AnyView, ViewId } from "../../api.core";
import type { Codec, ResultPath } from "../../api.codec";
import { view as defineView } from "../../views/definitions";
import { createActionRef, createRef } from "../../views/ref";

/** A codec under test, with the views and arguments it is given. */
export type CodecSubject = {
  readonly name: string;
  readonly create: () => Codec;

  /** Views to name: distinct definitions with equal fields, and ones it may reject. */
  readonly views: fc.Arbitrary<AnyView>;

  /** Arguments to capture and key, including ones it may reject. */
  readonly args: fc.Arbitrary<unknown>;

  /** The codec's own equality of arguments, for arguments it accepts. */
  readonly sameArgs: (view: AnyView, a: unknown, b: unknown) => boolean;

  /** Actions to name: distinct functions with equal fields, and ones it may reject. */
  readonly actions: fc.Arbitrary<Action>;

  /** The codec's own equality of action arguments, drawn from `args`, for ones it accepts. */
  readonly sameActionArgs: (action: Action, a: unknown, b: unknown) => boolean;
};

type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false };

/** Runs `action`, and checks that a failure is an `Error` of one of `kinds`. */
function attempt<T>(action: () => T, kinds: readonly string[]): Outcome<T> {
  try {
    return { ok: true, value: action() };
  } catch (error) {
    assert.ok(error instanceof Error);
    const kind: unknown = Reflect.get(error, "kind");
    assert.ok(
      typeof kind === "string" && kinds.includes(kind),
      `unexpected kind ${String(kind)}`,
    );
    assert.equal(typeof Reflect.get(error, "code"), "string");
    if (kind === "value")
      assert.equal(Reflect.get(error, "code"), "INVALID_ARGUMENT");
    return { ok: false };
  }
}

/**
 * A model of naming: a registry that gives each view or action at most one id for as long
 * as it lives, and each id to at most one of them. The codec chooses the ids and what it
 * rejects; its answers must fit one such registry.
 */
function namingModel<T>() {
  const idOf = new Map<T, string>();
  const ownerOf = new Map<string, T>();
  return {
    named: (target: T): string | undefined => idOf.get(target),
    accepts(target: T, id: string): boolean {
      const known = idOf.get(target);
      if (known !== undefined) return known === id;
      if (ownerOf.has(id)) return false;
      idOf.set(target, id);
      ownerOf.set(id, target);
      return true;
    },
  };
}

/** A result, with every ref placed in it, in no particular order. */
type Placed = { readonly value: unknown; readonly refs: readonly AnyRef[] };

const refTarget: AnyView = defineView({
  name: "target",
  resolve: (arg: number) => arg,
});

const actionTarget: Action = (arg: number) => arg;

const NO_REFS: readonly AnyRef[] = [];

const gather = (parts: readonly Placed[]): readonly AnyRef[] =>
  parts.flatMap((part) => part.refs);

/** Results of every kind a view returns, with the refs placed in them as they are built. */
const placed: fc.Arbitrary<Placed> = fc.letrec<{ node: Placed }>((tie) => {
  const node = tie("node");
  const leaf = fc
    .oneof(
      fc.constant(null),
      fc.boolean(),
      fc.integer(),
      fc.string(),
      fc.date(),
    )
    .map((value): Placed => ({ value, refs: NO_REFS }));
  const ref = fc.nat(9).map((arg): Placed => {
    const made = createRef(refTarget, arg);
    return { value: made, refs: [made] };
  });
  // An action ref is a leaf, never found.
  const actionRef = fc.nat(9).map(
    (arg): Placed => ({
      value: createActionRef(actionTarget, arg),
      refs: NO_REFS,
    }),
  );
  const array = fc.array(node, { maxLength: 4 }).map(
    (items): Placed => ({
      value: items.map((item) => item.value),
      refs: gather(items),
    }),
  );
  const object = fc.array(node, { maxLength: 4 }).map((items): Placed => {
    const value: Record<string, unknown> = {};
    for (const [index, item] of items.entries())
      value[`k${index}`] = item.value;
    return { value, refs: gather(items) };
  });
  // Keys of a Map are its indexes or refs, so no entry replaces another.
  const map = fc
    .array(fc.tuple(fc.option(ref, { nil: undefined }), node), { maxLength: 3 })
    .map((entries): Placed => {
      const parts = entries.flatMap(([key, item]) =>
        key === undefined ? [item] : [key, item],
      );
      const value = new Map(
        entries.map(([key, item], index) => [key?.value ?? index, item.value]),
      );
      return { value, refs: gather(parts) };
    });
  const set = fc.array(fc.oneof(ref, array, object), { maxLength: 3 }).map(
    (items): Placed => ({
      value: new Set(items.map((item) => item.value)),
      refs: gather(items),
    }),
  );
  return {
    node: fc.oneof(
      { depthSize: "small" },
      leaf,
      ref,
      actionRef,
      array,
      object,
      map,
      set,
    ),
  };
}).node;

/** How often each ref occurs. */
function countRefs(refs: readonly AnyRef[]): Map<AnyRef, number> {
  const counts = new Map<AnyRef, number>();
  for (const each of refs) counts.set(each, (counts.get(each) ?? 0) + 1);
  return counts;
}

/** What a path leads to: a key of a Map, else a property. */
function follow(value: unknown, path: ResultPath | undefined): unknown {
  if (path === undefined) return value;
  const at = follow(value, path.prev);
  return at instanceof Map
    ? at.get(path.key)
    : Reflect.get(Object(at), path.key);
}

/** The `Codec` contract, which every codec satisfies whatever its conventions. */
export function describeCodecContract(subject: CodecSubject): void {
  const { create, views, args, sameArgs, actions, sameActionArgs } = subject;

  void describe(`${subject.name}: codec contract`, () => {
    void it("names each view by one stable id, and no two views by the same id", () => {
      fc.assert(
        fc.property(
          fc.array(views, { minLength: 1, maxLength: 6 }),
          fc.array(fc.nat(), { maxLength: 30 }),
          (targets, calls) => {
            const codec = create();
            const model = namingModel<AnyView>();
            for (const call of [...calls, ...targets.keys()]) {
              const target = targets[call % targets.length];
              assert.ok(target);
              const named = attempt(() => codec.viewKey(target), ["view"]);
              if (named.ok) assert.ok(model.accepts(target, named.value));
              else assert.equal(model.named(target), undefined);
            }
          },
        ),
      );
    });

    void it("keys arguments alike exactly when the codec counts them equal", () => {
      fc.assert(
        fc.property(views, args, args, (target, a, b) => {
          const codec = create();
          const keyA = attempt(
            () => codec.argsKey(target, a),
            ["value", "view"],
          );
          const keyB = attempt(
            () => codec.argsKey(target, b),
            ["value", "view"],
          );
          if (keyA.ok && keyB.ok) {
            assert.equal(keyA.value === keyB.value, sameArgs(target, a, b));
          }
        }),
      );
    });

    void it("keys arguments the same way every time, and leaves them unchanged", () => {
      fc.assert(
        fc.property(views, fc.clone(args, 2), (target, [value, copy]) => {
          const codec = create();
          const first = attempt(
            () => codec.argsKey(target, value),
            ["value", "view"],
          );
          if (!first.ok) return;
          assert.equal(codec.argsKey(target, value), first.value);
          assert.ok(sameArgs(target, value, copy));
        }),
      );
    });

    void it("keys instances alike exactly when their view and arguments keys are alike", () => {
      fc.assert(
        fc.property(
          fc.array(views, { minLength: 1, maxLength: 3 }),
          fc.array(fc.tuple(fc.nat(), args), { minLength: 1, maxLength: 4 }),
          (targets, picks) => {
            const codec = create();
            const keyed: { view: ViewId; args: string; instance: string }[] =
              [];
            for (const [pick, value] of picks) {
              const target = targets[pick % targets.length];
              assert.ok(target);
              const instance = attempt(
                () => codec.instanceKey(target, value),
                ["value", "view"],
              );
              const view = attempt(() => codec.viewKey(target), ["view"]);
              const key = attempt(
                () => codec.argsKey(target, value),
                ["value", "view"],
              );
              assert.equal(instance.ok, view.ok && key.ok);
              if (!instance.ok || !view.ok || !key.ok) continue;
              assert.equal(codec.instanceKey(target, value), instance.value);
              for (const other of keyed) {
                const same: boolean =
                  other.view === view.value && other.args === key.value;
                assert.equal(other.instance === instance.value, same);
              }
              keyed.push({
                view: view.value,
                args: key.value,
                instance: instance.value,
              });
            }
          },
        ),
      );
    });

    void it("captures arguments it accepts as arguments with the same identity", () => {
      fc.assert(
        fc.property(views, args, (target, value) => {
          const codec = create();
          const captured = attempt(
            () => codec.captureArgs(target, value),
            ["value", "view"],
          );
          if (!captured.ok) return;
          const key = attempt(
            () => codec.argsKey(target, captured.value),
            ["value", "view"],
          );
          const again = codec.captureArgs(target, captured.value);
          if (key.ok) assert.equal(codec.argsKey(target, again), key.value);
        }),
      );
    });

    void it("finds every ref a result holds, as often as it holds it, the same way every time", () => {
      fc.assert(
        fc.property(views, placed, (target, result) => {
          const codec = create();
          const found = codec.findRefs(target, result.value);
          assert.deepEqual(countRefs(found.refs), countRefs(result.refs));
          const again = codec.findRefs(target, result.value).refs;
          assert.equal(again.length, found.refs.length);
          for (const [index, each] of found.refs.entries())
            assert.equal(again[index], each);
          const paths = found.paths;
          if (paths === undefined) return;
          assert.equal(paths.length, found.refs.length);
          for (const [index, path] of paths.entries()) {
            assert.equal(follow(result.value, path), found.refs[index]);
          }
        }),
      );
    });

    void it("accepts the results it captured", () => {
      fc.assert(
        fc.property(views, fc.anything(), (target, value) => {
          const codec = create();
          const captured = attempt(
            () => codec.captureResult(target, value),
            ["value", "view"],
          );
          if (captured.ok) codec.captureResult(target, captured.value);
        }),
      );
    });

    void it("names each action by one stable id, and no two actions by the same id", () => {
      fc.assert(
        fc.property(
          fc.array(actions, { minLength: 1, maxLength: 6 }),
          fc.array(fc.nat(), { maxLength: 30 }),
          (targets, calls) => {
            const codec = create();
            const model = namingModel<Action>();
            for (const call of [...calls, ...targets.keys()]) {
              const target = targets[call % targets.length];
              assert.ok(target);
              const named = attempt(
                (): ActionId => codec.actionKey(target),
                ["ref"],
              );
              if (named.ok) assert.ok(model.accepts(target, named.value));
              else assert.equal(model.named(target), undefined);
            }
          },
        ),
      );
    });

    void it("keys action arguments alike exactly when the codec counts them equal", () => {
      fc.assert(
        fc.property(actions, args, args, (target, a, b) => {
          const codec = create();
          const keyA = attempt(
            () => codec.actionArgsKey(target, a),
            ["value", "ref"],
          );
          const keyB = attempt(
            () => codec.actionArgsKey(target, b),
            ["value", "ref"],
          );
          if (keyA.ok && keyB.ok) {
            assert.equal(
              keyA.value === keyB.value,
              sameActionArgs(target, a, b),
            );
          }
        }),
      );
    });

    void it("keys action arguments the same way every time, captured or not", () => {
      fc.assert(
        fc.property(actions, fc.clone(args, 2), (target, [value, copy]) => {
          const codec = create();
          const first = attempt(
            () => codec.actionArgsKey(target, value),
            ["value", "ref"],
          );
          if (!first.ok) return;
          assert.equal(codec.actionArgsKey(target, value), first.value);
          assert.ok(sameActionArgs(target, value, copy));
          const captured = attempt(
            () => codec.captureActionArgs(target, copy),
            ["value", "ref"],
          );
          if (captured.ok)
            assert.equal(
              codec.actionArgsKey(target, captured.value),
              first.value,
            );
        }),
      );
    });
  });
}
