import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AnyView, ExternalViewFn, ViewFn } from "../index";
import type { RootFn } from "../api.runtime";

/** Compile-time checks; `yarn types` runs them, nothing calls them. */
function queryableChecks(
  view: ViewFn,
  external: ExternalViewFn,
  root: RootFn,
): void {
  const plain = view({ resolve: (id: string) => id.length });
  const room = view({
    access: { queryable: true },
    resolve: (id: string) => id.length,
  });
  const linked = external<typeof room>("ChatRoomV1");

  root(room, "chat-1");
  root(linked, "chat-1");
  // @ts-expect-error -- only a queryable view may be a root.
  root(plain, "chat-1");
  // @ts-expect-error -- arguments follow the root's signature.
  root(room, 1);

  const views: readonly AnyView[] = [plain, room, linked];
  assert.ok(views);
}

describe("queryable views", () => {
  it("are checked at compile time", () => {
    assert.equal(typeof queryableChecks, "function");
  });
});
