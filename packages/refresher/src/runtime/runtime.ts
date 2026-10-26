/**
 * `createRuntime`: one runtime instance, following `Runtime` in `../api.runtime`.
 *
 * It owns the lifetimes of what its executions use: it follows the change feed into the
 * change log and keeps the view cache. Drivers borrow its environment, codec and stores,
 * and a signal it aborts when disposed. Its queries run in passes, `./pass`. See
 * docs/architecture/lifecycles.md#controllers.
 */
import type { Revision } from "../api.core";
import type { ViewCache } from "../api.execution";
import type { ChangeLog } from "../api.invalidation";
import type { CreateRuntimeFn, Runtime } from "../api.runtime";
import type { StoreChange } from "../api.stores";
import { createJsonCodec } from "../codec/json";
import { assertSometimes } from "../env/assert";
import { sessionError } from "../errors";
import { createViewCache } from "../execution/viewCache";
import { createChangeLog } from "../invalidation/changeLog";
import { createBind } from "../views/bind";
import { throwIfOpen } from "../views/input";
import { createRef } from "../views/ref";
import { createPasses, type Passes } from "./pass";

export const createRuntime: CreateRuntimeFn = ({
  env,
  feed,
  store,
  codec = createJsonCodec(),
  viewCache: caches = true,
}) => {
  let changes: ChangeLog | undefined;
  let viewCache: ViewCache | undefined;
  let disposed = false;
  // eslint-disable-next-line prefer-const -- `deliver` reads it before it is assigned.
  let passes: Passes | undefined;

  const deliver = (delivered: readonly StoreChange[], at: Revision) => {
    if (changes === undefined) {
      changes = createChangeLog({ env, revision: at });
      return;
    }
    changes.append({ revision: at, changes: delivered });
    passes?.changed();
  };

  const detach = feed?.subscribe(deliver);
  if (changes === undefined) {
    if (feed !== undefined) {
      detach?.();
      throw sessionError({
        code: "FEED_NOT_ANNOUNCED",
        message: "The change feed announced no revision when it was subscribed",
      });
    }
    changes = createChangeLog({ env, revision: 0 });
  }
  const log: ChangeLog = changes;
  if (caches) viewCache = createViewCache({ env, changes: log });

  const disposal = new AbortController();
  const bind = createBind(codec);
  const queries = createPasses({
    env,
    changes: log,
    latestRevision: () => log.head,
    codec,
    bind,
    store,
    viewCache: () => viewCache,
  });
  passes = queries;
  const { run } = queries;

  const root: Runtime["root"] = (view, args?) => {
    const captured = codec.captureArgs(view, args);
    throwIfOpen(captured, "A root takes no open inputs");
    return createRef(
      view,
      captured,
      undefined,
      codec.instanceKey(view, captured),
    );
  };

  return {
    latestRevision: () => log.head,
    env,
    codec,
    store,
    get viewCache() {
      return viewCache;
    },
    signal: disposal.signal,
    root,
    bind,
    run,
    query: (view, args, driver) =>
      Promise.resolve(run({ driver, roots: [root(view, args)] })),
    immediateQuery: (view, args, driver) =>
      run({ driver, roots: [root(view, args)], immediate: true }),
    trim(revision) {
      if (disposed) return;
      const through = Math.min(revision, log.head);
      if (through <= log.tail) return;
      assertSometimes(
        env,
        viewCache !== undefined && viewCache.size > 0,
        "A trim validates kept instances",
      );
      viewCache?.validate(through);
      queries.validate();
      log.trim(through);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      detach?.();
      viewCache = undefined;
      const reason = sessionError({
        code: "DISPOSED",
        message: "The runtime is disposed",
      });
      disposal.abort(reason);
      queries.dispose(reason);
    },
  };
};
