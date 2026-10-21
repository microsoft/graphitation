import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AnyView, ViewFn } from "../index";
import type { RootFn } from "../api.runtime";

const refresh = (): void => {};
const rename = (title: string): string => title;
const clear = (title: string | undefined): string => title ?? "";

/** Compile-time checks; `yarn types` runs them, nothing calls them. */
function optionalArgsChecks(view: ViewFn, root: RootFn): void {
  const access = {
    readable: true,
    referenceable: true,
    queryable: true,
  } as const;
  const none = view({ access, resolve: (_args: undefined) => 1 });
  const maybe = view({ access, resolve: (id: string | undefined) => id ?? "" });
  const some = view({ access, resolve: (id: string) => id });

  const reader = view({
    resolve: (_args: undefined, { read, ref, action }) => {
      const one: number = read(none);
      const text: string = read(maybe);
      read(some, "chat-1");
      // @ts-expect-error -- arguments that may not be `undefined` are required.
      read(some);
      // @ts-expect-error -- arguments still follow the view's signature.
      read(none, "chat-1");

      ref(none);
      ref(none, undefined, {});
      ref(some, "chat-1", {});
      // @ts-expect-error -- arguments that may not be `undefined` are required.
      ref(some);

      action(refresh);
      action(clear);
      action(rename, "title");
      // @ts-expect-error -- arguments that may not be `undefined` are required.
      action(rename);
      return [one, text];
    },
  });

  root(none);
  root(maybe);
  root(some, "chat-1");
  // @ts-expect-error -- arguments that may not be `undefined` are required.
  root(some);

  const views: readonly AnyView[] = [none, maybe, some, reader];
  assert.ok(views);
}

describe("optional arguments", () => {
  it("are checked at compile time", () => {
    assert.equal(typeof optionalArgsChecks, "function");
  });
});
