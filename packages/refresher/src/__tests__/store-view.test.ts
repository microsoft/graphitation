import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  AnswerOf,
  AnyView,
  PromiseOrValue,
  StoreView,
  StoreViewContext,
  StoreViewFn,
  ViewFn,
} from "../index";

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y
  ? 1
  : 2
  ? true
  : false;
const equal = <X, Y>(same: Equal<X, Y>): boolean => same;

type Settings = {
  get(key: string): string | undefined;
  getAll(keys: readonly string[]): string[];
};

type Ctx = StoreViewContext;

const matches = (): boolean => true;

/** Compile-time checks; `yarn types` runs them, nothing calls them. */
function storeViewChecks(storeView: StoreViewFn, view: ViewFn): void {
  const sync = storeView({
    store: "settings",
    resolve: (key: string, { store }: { store: Settings }) => store.get(key),
    matches,
  });
  const syncTyped: StoreView<string, string | undefined> = sync;

  const later = storeView({
    store: "settings",
    resolve: (key: string) => Promise.resolve(key.length),
    matches,
  });
  const laterTyped: StoreView<string, number> = later;

  const batched = storeView({
    store: "settings",
    resolveBatch: (keys: readonly string[], { store }: { store: Settings }) =>
      store.getAll(keys),
    matches,
  });
  const batchedTyped: StoreView<string, string> = batched;

  const batchedLater = storeView({
    store: "settings",
    resolveBatch: (keys: readonly string[]) =>
      Promise.resolve(
        keys.map((key) => (key ? key.length : new Error("empty"))),
      ),
    matches,
  });
  const batchedLaterTyped: StoreView<string, number> = batchedLater;

  const wrapped = storeView({
    store: "settings",
    resolve: (
      key: string,
      { store, annotate }: { store: Settings } & Pick<Ctx, "annotate">,
    ) => annotate({ data: store.get(key), revision: 7 }),
    matches,
  });
  const wrappedLater = storeView({
    store: "settings",
    resolve: (key: string, { annotate }) =>
      Promise.resolve(annotate({ data: key.length })),
    matches,
  });
  const mixed = storeView({
    store: "settings",
    resolve: (key: string, { annotate }) =>
      key ? annotate({ data: key, footprint: { key } }) : "none",
    matches,
  });
  const wrappedBatch = storeView({
    store: "settings",
    resolveBatch: (keys: readonly string[], { annotate }) =>
      keys.map((key) =>
        key ? annotate({ data: key.length }) : new Error("empty"),
      ),
    matches,
  });
  const lookalike = storeView({
    store: "settings",
    resolve: (key: string) => ({ data: key }),
    matches,
  });
  type Edge = { readonly oldest: string };
  const page = storeView({
    store: "settings",
    resolve: (limit: number, { annotate }) =>
      annotate({ data: [String(limit)], footprint: { oldest: "a" } }),
    matches: (_limit, _change, footprint: Edge | undefined) =>
      footprint?.oldest !== "z",
  });
  equal<AnswerOf<typeof page>, string[]>(true);
  storeView({
    store: "settings",
    resolve: (limit: number, { annotate }) =>
      limit > 0 ? annotate({ data: limit, footprint: { oldest: "a" } }) : limit,
    matches: (_limit, _change, footprint) => {
      equal<typeof footprint, { oldest: string } | undefined>(true);
      return true;
    },
  });
  storeView({
    store: "settings",
    // @ts-expect-error -- the footprint is the type `matches` takes.
    resolve: (limit: number, { annotate }) =>
      annotate({ data: limit, footprint: { oldest: 1 } }),
    matches: (_limit, _change, footprint: Edge | undefined) =>
      footprint !== undefined,
  });
  equal<AnswerOf<typeof wrapped>, string | undefined>(true);
  equal<AnswerOf<typeof wrappedLater>, Promise<number>>(true);
  equal<AnswerOf<typeof mixed>, string>(true);
  const wrappedBatchTyped: StoreView<string, number> = wrappedBatch;
  equal<AnswerOf<typeof lookalike>, { data: string }>(true);

  // @ts-expect-error -- a store view supplies `resolve` or `resolveBatch`, not both.
  storeView({
    store: "settings",
    resolve: (key: string) => key,
    resolveBatch: (keys: readonly string[]) => keys,
    matches,
  });
  // @ts-expect-error -- a store view supplies one of them.
  storeView({ store: "settings", matches });

  equal<AnswerOf<typeof sync>, string | undefined>(true);
  equal<AnswerOf<typeof later>, Promise<number>>(true);
  equal<AnswerOf<typeof batched>, PromiseOrValue<string>>(true);
  view({
    resolve: (key: string, { read }) => {
      equal<ReturnType<typeof read<typeof sync>>, string | undefined>(true);
      equal<ReturnType<typeof read<typeof batched>>, PromiseOrValue<string>>(
        true,
      );
      return read(sync, key) ?? "";
    },
  });
  // @ts-expect-error -- a batch is answered once its round forms.
  view({ resolve: (key: string, { read }) => read(batched, key).length });

  const views: readonly AnyView[] = [
    syncTyped,
    laterTyped,
    batchedTyped,
    batchedLaterTyped,
    wrappedBatchTyped,
  ];
  assert.ok(views);
}

describe("store views", () => {
  it("are checked at compile time", () => {
    assert.equal(typeof storeViewChecks, "function");
  });
});
