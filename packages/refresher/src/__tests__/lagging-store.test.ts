import assert from "node:assert/strict";
import { it } from "node:test";
import type {
  ChangeFeed,
  Revision,
  StoreChange,
  StoreChangeListener,
  StoreViewContext,
} from "../index";
import { createRuntime, defaultEnvironment, storeView, view } from "../index";
import { createSimpleDriver } from "../queries/simpleDriver";
import { settledStale } from "../invalidation/reads";

type FakeFeed = ChangeFeed & {
  deliver(changes: readonly StoreChange[], at: Revision): void;
};

function feedAt(revision: Revision): FakeFeed {
  const listeners = new Set<StoreChangeListener>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      listener([], revision);
      return () => void listeners.delete(listener);
    },
    deliver(changes, at) {
      for (const listener of listeners) listener(changes, at);
    },
  };
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
async function settle(rounds = 20): Promise<void> {
  for (let round = 0; round < rounds; round++) {
    await tick();
  }
}

void it("restarts a query reading a lagging store only for changes, the log trimmed or not", async () => {
  const cells = new Map<string, number>([["a", 1]]);
  let stoppedAt: Revision | undefined;
  const remote = storeView({
    store: "remote",
    name: "remote",
    resolve: (key: string, { annotate }: StoreViewContext) =>
      stoppedAt === undefined
        ? key
        : annotate({ data: key, revision: stoppedAt }),
    matches: (key: string, change) =>
      change.operation === "answer" && change.value === key,
  });
  const cell = storeView({
    store: "cells",
    name: "cell",
    resolve: (key: string, { store }: StoreViewContext<Map<string, number>>) =>
      store.get(key),
    matches: (key: string, change) => change.value === key,
  });
  const root = view({
    name: "root",
    access: { queryable: true },
    resolve: (_args: undefined, { read }) => ({
      remote: read(remote, "x"),
      cell: read(cell, "a"),
    }),
  });
  let passes = 0;
  // Caps passes: a runtime that never settles would starve the event loop.
  const env = {
    ...defaultEnvironment,
    scheduleUpdatePass: (callback: () => void) => {
      if (++passes <= 50) defaultEnvironment.scheduleUpdatePass(callback);
    },
  };
  const feed = feedAt(1);
  const runtime = createRuntime({
    env,
    feed,
    store: (name) => (name === "cells" ? cells : {}),
  });
  const result = await runtime.query(root, undefined, createSimpleDriver());
  const outputs: { data: unknown; stale: boolean }[] = [];
  const subscription = result.subscribe({
    next: (each) => {
      assert.ok("output" in each);
      const instance = each.output.roots[0]!;
      assert.ok(
        instance.status === "settled" && instance.descriptor !== undefined,
      );
      outputs.push({
        data: instance.data,
        stale: settledStale(instance.descriptor),
      });
    },
    error: (error) => assert.fail(String(error)),
  });
  // The remote query closes: from now on its store answers as of revision 2.
  stoppedAt = 2;
  feed.deliver([{ store: "remote", operation: "closed", value: "x" }], 2);
  cells.set("a", 2);
  feed.deliver([{ store: "cells", operation: "put", value: "a" }], 3);
  await settle();
  assert.deepEqual(outputs, [{ data: { remote: "x", cell: 2 }, stale: true }]);
  // The log lets go of every change through 3, the stale read's revision with them.
  runtime.trim(3);
  cells.set("a", 3);
  feed.deliver([{ store: "cells", operation: "put", value: "a" }], 4);
  await settle(40);
  assert.deepEqual(outputs.slice(1), [
    { data: { remote: "x", cell: 3 }, stale: true },
  ]);
  // The remote store catches up: the change it registers restarts the stale read, once.
  stoppedAt = undefined;
  feed.deliver([{ store: "remote", operation: "answer", value: "x" }], 5);
  await settle(40);
  subscription.unsubscribe();
  runtime.dispose();
  assert.deepEqual(outputs.slice(2), [
    { data: { remote: "x", cell: 3 }, stale: false },
  ]);
  assert.ok(passes < 50, `ran ${passes} passes`);
});
