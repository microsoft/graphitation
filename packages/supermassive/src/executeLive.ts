import { GraphQLError, Kind, SelectionSetNode } from "graphql";
import type { ExecutionContext } from "./executeWithoutSchema";
import type { ILiveSource } from "./liveSource";
import type { PromiseOrValue } from "./jsutils/PromiseOrValue";
import type {
  ExecutionResult,
  LiveExecutionResult,
  TotalExecutionResult,
} from "./types";
import {
  GraphQLDeferDirective,
  GraphQLIncludeDirective,
  GraphQLLiveDirective,
  GraphQLSkipDirective,
  GraphQLStreamDirective,
} from "./schema/directives";
import { getDirectiveValues } from "./values";

export interface LiveSourceTracker {
  read(source: ILiveSource<unknown>): unknown;
}

export function isLiveOperation(context: ExecutionContext): boolean {
  const liveDirectives = context.operation.directives?.filter(
    (directive) => directive.name.value === "live",
  );
  if (liveDirectives?.length && context.operation.operation !== "query") {
    throw new GraphQLError(
      "@live is only supported on query operations.",
      liveDirectives,
    );
  }
  if (liveDirectives && liveDirectives.length > 1) {
    throw new GraphQLError("@live cannot be repeated.", liveDirectives);
  }
  const live = getDirectiveValues(
    context,
    GraphQLLiveDirective,
    context.operation,
  );
  const enabled = live?.if === true;
  const visited = new Set<string>();

  const checkSelections = (selectionSet: SelectionSetNode): void => {
    for (const selection of selectionSet.selections) {
      const misplaced = selection.directives?.find(
        (directive) => directive.name.value === "live",
      );
      if (misplaced) {
        throw new GraphQLError(
          "@live is only supported on query operations.",
          misplaced,
        );
      }
      if (enabled) {
        const skip = getDirectiveValues(
          context,
          GraphQLSkipDirective,
          selection,
        );
        const include = getDirectiveValues(
          context,
          GraphQLIncludeDirective,
          selection,
        );
        if (skip?.if === true || include?.if === false) {
          continue;
        }
        for (const directive of [
          GraphQLDeferDirective,
          GraphQLStreamDirective,
        ]) {
          const value = getDirectiveValues(context, directive, selection);
          if (value && value.if !== false) {
            throw new GraphQLError(
              "@live cannot be combined with active @defer or @stream directives.",
              selection,
            );
          }
        }
      }
      if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const name = selection.name.value;
        if (visited.has(name)) continue;
        visited.add(name);
        const fragment = context.fragments[name];
        if (fragment) {
          const misplaced = fragment.directives?.find(
            (directive) => directive.name.value === "live",
          );
          if (misplaced) {
            throw new GraphQLError(
              "@live is only supported on query operations.",
              misplaced,
            );
          }
          checkSelections(fragment.selectionSet);
        }
      } else if (selection.selectionSet) {
        checkSelections(selection.selectionSet);
      }
    }
  };
  checkSelections(context.operation.selectionSet);
  return enabled;
}

export function executeLive(
  execute: (tracker: LiveSourceTracker) => PromiseOrValue<ExecutionResult>,
): LiveExecutionResult {
  const subscriptions = new Map<ILiveSource<unknown>, () => void>();
  let active = true;
  let dirty = true;
  let running = false;
  let pending:
    | {
        resolve: (value: IteratorResult<TotalExecutionResult, void>) => void;
        reject: (error: unknown) => void;
      }
    | undefined;

  const dispose = (): { error: unknown } | undefined => {
    let failure: { error: unknown } | undefined;
    for (const [source, unsubscribe] of subscriptions) {
      subscriptions.delete(source);
      try {
        unsubscribe();
      } catch (caught) {
        failure ??= { error: caught };
      }
    }
    return failure;
  };
  const done = (): IteratorReturnResult<void> => ({
    value: undefined,
    done: true,
  });
  const invalidate = () => {
    if (!active) return;
    dirty = true;
    void run();
  };
  const run = async () => {
    if (!active || running || !dirty || !pending) return;
    running = true;
    dirty = false;
    let collecting = true;
    let subscriptionError: unknown;
    let subscriptionFailed = false;
    const seen = new Set<ILiveSource<unknown>>();
    try {
      const result = await execute({
        read(source) {
          if (!active || !collecting) return undefined;
          seen.add(source);
          if (!subscriptions.has(source)) {
            try {
              let subscribing = true;
              const unsubscribe = source.subscribe(() => {
                // The following read already observes synchronous setup updates.
                if (!subscribing) invalidate();
              });
              subscribing = false;
              if (typeof unsubscribe !== "function") {
                throw new TypeError(
                  "Live source subscribe must return a disposer.",
                );
              }
              if (active) {
                subscriptions.set(source, unsubscribe);
              } else {
                unsubscribe();
              }
            } catch (error) {
              subscriptionFailed = true;
              subscriptionError = error;
              throw error;
            }
          }
          return active ? source.read() : undefined;
        },
      });
      collecting = false;
      if (!active) return;
      if (subscriptionFailed) throw subscriptionError;
      if ("initialResult" in result || Symbol.asyncIterator in result) {
        throw new Error(
          "Live revisions must produce complete execution results.",
        );
      }
      for (const [source, unsubscribe] of subscriptions) {
        if (!seen.has(source)) {
          subscriptions.delete(source);
          unsubscribe();
        }
      }
      if (!dirty) {
        const waiter = pending;
        pending = undefined;
        waiter?.resolve({ value: result, done: false });
      }
    } catch (error) {
      if (active) {
        active = false;
        dispose();
        const waiter = pending;
        pending = undefined;
        waiter?.reject(error);
      }
    } finally {
      collecting = false;
      running = false;
      if (active && dirty && pending) {
        // Yield between revisions, including synchronous invalidation during a read.
        void Promise.resolve().then(run);
      }
    }
  };

  return {
    next() {
      if (!active) return Promise.resolve(done());
      if (pending) {
        return Promise.reject(
          new Error("Concurrent live iterator next() calls are not supported."),
        );
      }
      const result = new Promise<IteratorResult<TotalExecutionResult, void>>(
        (resolve, reject) => {
          pending = { resolve, reject };
        },
      );
      void run();
      return result;
    },
    return() {
      active = false;
      const failure = dispose();
      pending?.resolve(done());
      pending = undefined;
      return failure ? Promise.reject(failure.error) : Promise.resolve(done());
    },
    throw(error) {
      active = false;
      dispose();
      pending?.reject(error);
      pending = undefined;
      return Promise.reject(error);
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
