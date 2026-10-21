import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  AnswerOf,
  AnyView,
  PromiseOrValue,
  ResultOf,
  ViewFn,
  ViewSchema,
} from "../index";

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y
  ? 1
  : 2
  ? true
  : false;
const equal = <X, Y>(same: Equal<X, Y>): boolean => same;

/** Compile-time checks; `yarn types` runs them, nothing calls them. */
function answerChecks(
  view: ViewFn,
  schema: ViewSchema<string, { readonly n: number }>,
): void {
  const length = view({
    access: { readable: true },
    resolve: (id: string) => id.length,
  });
  const later = view({
    access: { readable: true },
    resolve: async (id: string) => id.length,
  });
  const either = view({
    access: { readable: true },
    resolve: (id: string) => (id ? id.length : Promise.resolve(0)),
  });

  view({
    resolve: (id: string, { read }) => {
      equal<ReturnType<typeof read<typeof length>>, number>(true);
      equal<ReturnType<typeof read<typeof later>>, PromiseOrValue<number>>(
        true,
      );
      equal<ReturnType<typeof read<typeof either>>, PromiseOrValue<number>>(
        true,
      );
      return read(length, id) + 1;
    },
  });

  const summed = view({
    resolve: (id: string, { read }) => read(length, id) + 1,
  });
  equal<AnswerOf<typeof summed>, number>(true);
  equal<ResultOf<typeof summed>, number>(true);
  const awaited = view({
    resolve: async (id: string, { read }) => (await read(later, id)) + 1,
  });
  equal<AnswerOf<typeof awaited>, Promise<number>>(true);
  equal<ResultOf<typeof awaited>, number>(true);

  // @ts-expect-error -- a `resolve` that returns its result itself cannot read a view that may wait.
  view({ resolve: (id: string, { read }) => read(later, id) + 1 });

  const fromSchema = view({ schema, resolve: (id) => ({ n: id.length }) });
  const fromSchemaLater = view({
    schema,
    resolve: async (id) => ({ n: id.length }),
  });
  equal<ResultOf<typeof fromSchema>, { readonly n: number }>(true);
  equal<AnswerOf<typeof fromSchemaLater>, Promise<{ n: number }>>(true);
  // @ts-expect-error -- the schema's result holds `resolve` to it.
  view({ schema, resolve: (id) => ({ n: id }) });

  const explicit = view<string, number>({ resolve: (id) => id.length });
  const explicitLater = view<string, Promise<number>>({
    resolve: async (id) => id.length,
  });
  equal<AnswerOf<typeof explicit>, number>(true);
  equal<ResultOf<typeof explicitLater>, number>(true);
  // @ts-expect-error -- explicit type arguments name the answer.
  view<string, number>({ resolve: async (id) => id.length });

  const views: readonly AnyView[] = [
    length,
    later,
    either,
    summed,
    awaited,
    fromSchema,
    fromSchemaLater,
    explicit,
    explicitLater,
  ];
  assert.ok(views);
}

describe("view answers", () => {
  it("are checked at compile time", () => {
    assert.equal(typeof answerChecks, "function");
  });
});
