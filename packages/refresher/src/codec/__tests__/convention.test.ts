import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as fc from "fast-check";
import type { Action, ActionId, AnyView, ViewId } from "../../api.core";
import type { ProjectActionExtensions, ProjectView } from "../convention";
import { createConventionCodec } from "../convention";
import { describeCodecContract } from "./contract";

type Definition = AnyView & Partial<ProjectView>;

const keyers: readonly ((args: unknown) => string)[] = [
  (args) => JSON.stringify({ args }),
  (args) => `k${typeof args}`,
];

/** Definitions with or without an id and an `argsKey`, with ids that often collide. */
const views: fc.Arbitrary<Definition> = fc.record(
  {
    id: fc.string({ maxLength: 2 }),
    name: fc.string({ maxLength: 2 }),
    argsKey: fc.constantFrom(...keyers),
  },
  { requiredKeys: [] },
);

type ProjectAction = Action & Partial<ProjectActionExtensions>;

/** Distinct actions with or without an id and an `argsKey`, with ids that often collide. */
const actions: fc.Arbitrary<ProjectAction> = fc
  .record(
    { id: fc.string({ maxLength: 2 }), argsKey: fc.constantFrom(...keyers) },
    { requiredKeys: [] },
  )
  .map((fields): ProjectAction => Object.assign((arg: unknown) => arg, fields));

const args = fc.option(fc.jsonValue(), { nil: undefined });

describeCodecContract({
  name: "convention codec",
  create: createConventionCodec,
  views,
  args,
  sameArgs: (view: Definition, a, b) => view.argsKey?.(a) === view.argsKey?.(b),
  actions,
  sameActionArgs: (action: ProjectAction, a, b) =>
    action.argsKey?.(a) === action.argsKey?.(b),
});

/**
 * A model of the convention codec as its definition documents it: a view goes by its
 * `id`, unless it has none or another view goes by it, and keys its own arguments.
 * Returns the id or key, or the code it fails with.
 */
function conventionModel() {
  const owners = new Map<ViewId, AnyView>();
  return {
    viewKey(view: Definition): string {
      if (view.id === undefined) return "MISSING_VIEW_ID";
      const owner = owners.get(view.id) ?? view;
      if (owner !== view) return "DUPLICATE_VIEW";
      owners.set(view.id, view);
      return view.id;
    },
    argsKey: (view: Definition, given: unknown): string =>
      view.argsKey === undefined ? "MISSING_ARGS_KEY" : view.argsKey(given),
  };
}

/** The same model for actions. */
function actionConventionModel() {
  const owners = new Map<ActionId, Action>();
  return {
    actionKey(action: ProjectAction): string {
      if (action.id === undefined) return "MISSING_ACTION_ID";
      const owner = owners.get(action.id) ?? action;
      if (owner !== action) return "DUPLICATE_ACTION";
      owners.set(action.id, action);
      return action.id;
    },
    argsKey: (action: ProjectAction, given: unknown): string =>
      action.argsKey === undefined ? "MISSING_ARGS_KEY" : action.argsKey(given),
  };
}

function keyOrCode(action: () => string, kind = "view"): string {
  try {
    return action();
  } catch (error) {
    assert.ok(error instanceof Error);
    assert.equal(Reflect.get(error, "kind"), kind);
    return String(Reflect.get(error, "code"));
  }
}

describe("convention codec", () => {
  it("names views by their id and keys arguments as their definitions say", () => {
    fc.assert(
      fc.property(
        fc.array(views, { minLength: 1, maxLength: 6 }),
        fc.array(fc.tuple(fc.nat(), args), { maxLength: 20 }),
        (targets, calls) => {
          const codec = createConventionCodec();
          const model = conventionModel();
          for (const [index, given] of calls) {
            const target = targets[index % targets.length];
            assert.ok(target);
            assert.equal(
              keyOrCode(() => codec.viewKey(target)),
              model.viewKey(target),
            );
            assert.equal(
              keyOrCode(() => codec.argsKey(target, given)),
              model.argsKey(target, given),
            );
            assert.equal(codec.captureArgs(target, given), given);
            assert.equal(codec.captureResult(target, given), given);
          }
        },
      ),
    );
  });
});

describe("convention codec actions", () => {
  it("names actions by their id and keys arguments as the actions say", () => {
    fc.assert(
      fc.property(
        fc.array(actions, { minLength: 1, maxLength: 6 }),
        fc.array(fc.tuple(fc.nat(), args), { maxLength: 20 }),
        (targets, calls) => {
          const codec = createConventionCodec();
          const model = actionConventionModel();
          for (const [index, given] of calls) {
            const target = targets[index % targets.length];
            assert.ok(target);
            assert.equal(
              keyOrCode(() => codec.actionKey(target), "ref"),
              model.actionKey(target),
            );
            assert.equal(
              keyOrCode(() => codec.actionArgsKey(target, given), "ref"),
              model.argsKey(target, given),
            );
            assert.equal(codec.captureActionArgs(target, given), given);
          }
        },
      ),
    );
  });
});
