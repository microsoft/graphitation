/* Runtime tests of open inputs: made by views, bound by `bind`, refused where a ref must be bound. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as fc from "fast-check";
import type {
  AnyActionRef,
  AnyRef,
  AnyView,
  QueryableView,
  Ref,
  ResolveContext,
  Runtime,
  ViewInstance,
} from "../index";
import { createRuntime, defaultEnvironment, isOpenInput, view } from "../index";
import { createSimpleDriver } from "../queries/simpleDriver";
import type { SimpleDriverOutput } from "../queries/simpleDriver";

const TAG = "follow";
const NAMES = ["a", "b", "c"] as const;

const leafView = view({
  name: "leaf",
  access: { readable: true, referenceable: true },
  resolve: (args: unknown) => args,
});

/** Where an input goes in arguments, with its name and, maybe, its default. */
type Hole = {
  readonly hole: string;
  readonly default?: number | string | boolean | null;
};

/** Arguments with holes: JSON, but for the holes. */
type Shape =
  | null
  | boolean
  | number
  | string
  | Hole
  | readonly Shape[]
  | { [key: string]: Shape };

const scalar = fc.oneof(
  fc.constant(null),
  fc.boolean(),
  fc.integer(),
  fc.string({ maxLength: 3 }),
);

const hole: fc.Arbitrary<Hole> = fc.record(
  { hole: fc.constantFrom(...NAMES), default: scalar },
  { requiredKeys: ["hole"] },
);

const nested: fc.Arbitrary<Shape> = fc.letrec<{ shape: Shape }>((tie) => ({
  shape: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    scalar,
    { arbitrary: hole, weight: 2 },
    fc.array(tie("shape"), { maxLength: 3 }),
    fc.dictionary(fc.constantFrom("x", "y", "z"), tie("shape"), { maxKeys: 3 }),
  ),
})).shape;

/** About one in eight leaves an input without a value or a default: see `fc.statistics`. */
const shapes: fc.Arbitrary<Shape> = fc.oneof(
  nested,
  fc.array(nested, { minLength: 1, maxLength: 4 }),
);

const values = fc.dictionary(fc.constantFrom(...NAMES, "unused"), scalar, {
  maxKeys: 3,
});

function isHole(shape: Shape): shape is Hole {
  return (
    typeof shape === "object" &&
    shape !== null &&
    !Array.isArray(shape) &&
    isHoleRecord(shape)
  );
}

function isHoleRecord(record: object): boolean {
  return (
    typeof Reflect.get(record, "hole") === "string" &&
    Object.keys(record).length <= 2
  );
}

/** The arguments `shape` makes, each hole an input made by `context`. */
function template(shape: Shape, context: ResolveContext): unknown {
  if (isHole(shape)) {
    return Object.hasOwn(shape, "default")
      ? context.input(shape.hole, { default: shape.default })
      : context.input(shape.hole);
  }
  if (Array.isArray(shape))
    return shape.map((item: Shape) => template(item, context));
  if (typeof shape !== "object" || shape === null) return shape;
  const record: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(shape))
    record[key] = template(item, context);
  return record;
}

const MISSING = Symbol("missing");

/** The arguments `shape` makes bound to `given`, or `MISSING` if a hole has no value. */
function expected(
  shape: Shape,
  given: Readonly<Record<string, unknown>>,
): unknown {
  if (isHole(shape)) {
    if (Object.hasOwn(given, shape.hole)) return given[shape.hole];
    return Object.hasOwn(shape, "default") ? shape.default : MISSING;
  }
  if (Array.isArray(shape)) {
    const items = shape.map((item: Shape) => expected(item, given));
    return items.includes(MISSING) ? MISSING : items;
  }
  if (typeof shape !== "object" || shape === null) return shape;
  const record: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(shape)) {
    const value = expected(item, given);
    if (value === MISSING) return MISSING;
    record[key] = value;
  }
  return record;
}

function holes(shape: Shape): number {
  if (isHole(shape)) return 1;
  if (Array.isArray(shape))
    return shape.reduce((sum: number, item: Shape) => sum + holes(item), 0);
  if (typeof shape !== "object" || shape === null) return 0;
  return Object.values(shape).reduce(
    (sum: number, item) => sum + holes(item),
    0,
  );
}

function holdsInput(value: unknown): boolean {
  if (isOpenInput(value)) return true;
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value).some(holdsInput);
}

/**
 * The data the root view returns for `make`, run once with the simple driver following
 * refs tagged `TAG`, with every instance it reached.
 */
function runRoot(
  runtime: Runtime,
  make: (context: ResolveContext) => unknown,
): { readonly data: unknown; readonly instances: readonly ViewInstance[] } {
  const root = view({
    name: "root",
    access: { queryable: true },
    resolve: (_args: undefined, context) => make(context),
  });
  const output = outputOf(runtime, root);
  const [instance] = output.roots;
  assert.ok(instance !== undefined);
  assert.deepEqual(instance.errors, []);
  return { data: instance.data, instances: [...output.instances.values()] };
}

/** Runs `root` once with the simple driver following refs tagged `TAG`. */
function outputOf(runtime: Runtime, root: QueryableView): SimpleDriverOutput {
  const result = runtime.immediateQuery(
    root,
    undefined,
    createSimpleDriver([TAG]),
  );
  assert.ok(!(result instanceof Promise), "the query settles at once");
  assert.ok("output" in result, "the simple driver delivers whole");
  return result.output;
}

/** `runtime.bind` for a ref of either kind. */
function bindEither(
  runtime: Runtime,
  ref: AnyRef | AnyActionRef,
  given: object,
): AnyRef | AnyActionRef {
  const bind = runtime.bind as (
    ref: AnyRef | AnyActionRef,
    values: object,
  ) => AnyRef | AnyActionRef;
  return bind(ref, given);
}

function newRuntime(): Runtime {
  return createRuntime({ env: defaultEnvironment });
}

function codeOf(error: unknown): unknown {
  return typeof error === "object" && error !== null
    ? Reflect.get(error, "code")
    : undefined;
}

const send = (_args: {
  readonly chatId: string;
  readonly text: string;
}): void => {};

describe("open inputs", () => {
  it("bind to the values given, else their defaults, else fail", () => {
    fc.assert(
      fc.property(shapes, values, (args, given) => {
        const runtime = newRuntime();
        const { data } = runRoot(runtime, (context) => ({
          view: context.ref(leafView, template(args, context)),
          action: context.action(send, template(args, context) as never),
        }));
        const { view: made, action } = data as {
          view: AnyRef;
          action: AnyActionRef;
        };
        const bound = expected(args, given);
        for (const ref of [made, action]) {
          if (holes(args) === 0) {
            assert.equal(
              bindEither(runtime, ref, given),
              ref,
              "nothing to bind returns the ref",
            );
            continue;
          }
          if (bound === MISSING) {
            assert.throws(
              () => bindEither(runtime, ref, given),
              (error: unknown) => codeOf(error) === "MISSING_INPUT",
            );
            continue;
          }
          const result = bindEither(runtime, ref, given);
          assert.deepEqual(result.args, bound);
          assert.equal(result.meta, ref.meta);
          assert.ok(!holdsInput(result.args));
          assert.ok(holdsInput(ref.args), "the template is left as it was");
        }
        const viewBound =
          bound === MISSING || holes(args) === 0
            ? undefined
            : runtime.bind(made, given);
        if (viewBound !== undefined) {
          assert.equal(viewBound.view, leafView);
          assert.equal(
            runtime.codec.instanceKey(viewBound.view, viewBound.args),
            runtime.codec.instanceKey(leafView, bound),
          );
        }
      }),
    );
  });

  it("key apart from any arguments binding them", () => {
    fc.assert(
      fc.property(
        shapes.filter((args) => holes(args) > 0),
        values,
        (args, given) => {
          const runtime = newRuntime();
          const { data } = runRoot(runtime, (context) =>
            context.ref(leafView, template(args, context)),
          );
          const made = data as AnyRef;
          const key = runtime.codec.argsKey(leafView, made.args);
          const bound = expected(args, given);
          if (bound !== MISSING)
            assert.notEqual(key, runtime.codec.argsKey(leafView, bound));
        },
      ),
    );
  });

  it("key by name, default and the view leaving them open", () => {
    const runtime = newRuntime();
    const other = view({
      name: "other",
      access: { readable: true, referenceable: true },
      resolve: (_args: undefined, { input }) => input("a"),
    });
    const { data } = runRoot(runtime, (context) => [
      context.input("a"),
      context.input("a"),
      context.input("b"),
      context.input("a", { default: 1 }),
      context.input("a", { default: undefined }),
      context.read(other, undefined),
    ]);
    const keys = (data as unknown[]).map((input) =>
      runtime.codec.argsKey(leafView, input),
    );
    assert.equal(keys[0], keys[1]);
    assert.equal(new Set(keys).size, keys.length - 1);
  });

  it("are made frozen and recognized, while data of their shape is not", () => {
    const runtime = newRuntime();
    const { data } = runRoot(runtime, (context) =>
      context.input("a", { default: 1 }),
    );
    assert.ok(isOpenInput(data));
    assert.ok(Object.isFrozen(data));
    assert.equal(data.name, "a");
    assert.equal(data.default, 1);
    assert.ok(!isOpenInput({ name: "a", view: leafView, default: 1 }));
    assert.ok(!isOpenInput(null));
  });

  it("need a name", () => {
    const runtime = newRuntime();
    const root = view({
      name: "root",
      access: { queryable: true },
      resolve: (_args: undefined, { input }) => input(""),
    });
    const output = outputOf(runtime, root);
    assert.deepEqual(
      output.roots[0]?.errors.map((error) => error.code),
      ["INVALID_INPUT"],
    );
  });

  it("are refused by `read`", () => {
    const runtime = newRuntime();
    const root = view({
      name: "root",
      access: { queryable: true },
      resolve: (_args: undefined, { read, input }) =>
        read(leafView, { x: [input("a")] }),
    });
    const output = outputOf(runtime, root);
    const errors = output.roots[0]?.errors ?? [];
    assert.deepEqual(
      errors.map((error) => error.code),
      ["OPEN_INPUT"],
    );
  });

  it("are refused in the refs an execution follows", () => {
    const runtime = newRuntime();
    const { data } = runRoot(runtime, (context) =>
      context.ref(leafView, context.input("a")),
    );
    const root = runtime.root(
      view({ name: "start", access: { queryable: true }, resolve: () => null }),
    );
    assert.throws(
      () =>
        runtime.run({
          driver: createSimpleDriver(),
          roots: [root, data as Ref],
          immediate: true,
        }),
      (error: unknown) => codeOf(error) === "OPEN_INPUT",
    );
  });

  it("are bound with their defaults by the simple driver, which skips those without", () => {
    const runtime = newRuntime();
    const meta = { tags: [TAG] };
    const { instances } = runRoot(runtime, (context) => [
      context.ref(leafView, { n: context.input("n", { default: 1 }) }, meta),
      context.ref(leafView, { n: context.input("m") }, meta),
    ]);
    const leaves = instances.filter(
      (instance) => instance.view === (leafView as AnyView),
    );
    assert.deepEqual(
      leaves.map((instance) => instance.args),
      [{ n: 1 }],
    );
  });
});
