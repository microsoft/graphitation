/**
 * What the activity tab shows of a runtime, as a tracer for its side records it: each
 * delivery of its feed, each pass and the queries it starts or restarts, each action, and
 * each message to or from another runtime. Every event is stamped on the side's hybrid
 * clock, so the tab lays every side out on one time axis.
 */
import type {
  ChangeFeed,
  QueryArgs,
  QueryDriver,
  QueryRestartArgs,
  QueryResult,
  Ref,
  Runtime,
  StoreChange,
  ViewInstance,
} from "../../../../src/index";
import type { ActionScope } from "../actions";
import { internalsOf } from "../../../../src/views/definitions";
import type { HybridClock } from "../clock";
import { decodeActionRef } from "../protocol";
import type { FromHost, ToHost } from "../protocol";
import { brief, describe, labelOf, viewName } from "./describe";
import type { DescribeOptions } from "./describe";
import type {
  TraceEvent,
  TracedChange,
  TracedHit,
  TracedInstance,
} from "./protocol";

export type Trace = (event: TraceEvent) => void;

/** An event before its side stamps it. */
type Unstamped<E> = E extends unknown ? Omit<E, "side" | "seq" | "at"> : never;

type Settled = Extract<TraceEvent, { readonly kind: "settled" }>;

export type Tracer = {
  /** `feed`, tracing each delivery the runtime following it takes. */
  feed(feed: ChangeFeed): ChangeFeed;
  /**
   * `runtime`, tracing the passes that start or restart its queries: each `run`, `query`
   * and `immediateQuery`, through the runtime this answers.
   */
  runtime(runtime: Runtime): Runtime;
  /**
   * What actions run in from outside any action: each traced as it starts and once it
   * settles, with what it reads, runs and answers with traced inside it.
   */
  readonly scope: ActionScope;
  /** Calls `call`, an action, tracing it as `scope` does. Answers what `call` does. */
  call<T>(name: string, args: unknown, call: () => T): T;
  /**
   * Traces a message to or from `peer`. An action that starts as one comes in, in the same
   * task, runs for it.
   */
  wire(
    peer: string,
    direction: "out" | "in",
    summary: string,
    message: unknown,
    failed: boolean,
  ): void;
};

export type TracerArgs = {
  /** The runtime traced. */
  readonly side: string;
  /** The side's clock: what stamps its revisions, and its events. */
  readonly clock: HybridClock;
  readonly trace: Trace;
  /** Describes values, as another runtime's refs among them. */
  readonly options?: DescribeOptions;
};

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const plural = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

const refLabel = (ref: Ref): string => labelOf(viewName(ref.view), ref.args);

/** Another runtime's action ref, as far as it decodes: running one that does not fails there. */
const decoded = (
  ref: string,
): { readonly action: string; readonly args: unknown } => {
  try {
    return decodeActionRef(ref);
  } catch {
    return { action: ref, args: undefined };
  }
};

export function createTracer({
  side,
  clock,
  trace,
  options = {},
}: TracerArgs): Tracer {
  let seq = 0;
  /** The latest stamp: a side's events never go back in time. */
  let latest = 0;
  /** The pass the queries launched in this task, at its revision, join. */
  let open: { readonly seq: number; readonly revision: number } | undefined;
  /** How many messages went each way, by peer and direction. */
  const wired = new Map<string, number>();
  /** The action whose reads run now: their queries are its, not a pass's. */
  let reader: number | undefined;
  /** The action another runtime's ref is being sent to run as. */
  let carrying: number | undefined;
  /** The message that came in this task: the action it starts runs for it. */
  let delivering: { readonly peer: string; readonly n: number } | undefined;

  const emit = (event: Unstamped<TraceEvent>, at = clock.now()): number => {
    latest = Math.max(latest, at);
    seq++;
    trace({ ...event, side, seq, at: latest });
    return seq;
  };

  /** What a change changed, in one line: a ref's label, a key, or its value. */
  const labelOfChange = ({ value }: StoreChange): string => {
    if (typeof value === "string") {
      const encoded = options.encoded?.(value);
      return encoded?.kind === "ref"
        ? labelOf(encoded.view, encoded.args)
        : value;
    }
    if (typeof value === "object" && value !== null && "key" in value)
      return brief(value.key);
    return brief(value);
  };

  const changeOf = (change: StoreChange): TracedChange => ({
    store: change.store,
    operation: change.operation,
    label: labelOfChange(change),
    value: describe(change.value, options),
  });

  const hitOf = ({
    descriptor,
    reason,
  }: QueryRestartArgs["invalidated"]["stale"][number]): TracedHit => {
    const instance = labelOf(viewName(descriptor.view), descriptor.args);
    if (reason.kind === "unverifiable")
      return { instance, kind: "unverifiable" };
    return {
      instance,
      kind: "hit",
      store: reason.change.store,
      operation: reason.change.operation,
      label: labelOfChange(reason.change),
      revision: reason.revision,
    };
  };

  /** Every instance the result's first part ran, described. */
  const instancesOf = (result: QueryResult<unknown>): TracedInstance[] => {
    const { waves } = "waves" in result ? result : result.initialResult;
    const instances: TracedInstance[] = [];
    const add = (instance: ViewInstance): void =>
      void instances.push({
        label: labelOf(viewName(instance.view), instance.args),
        data: describe(instance.data, options),
        errors: instance.errors.map((error) => error.message),
        reads: [...(instance.descriptor?.storeReads.values() ?? [])]
          .flat()
          .map((read) => ({
            label: labelOf(viewName(read.view), read.args),
            revision: read.revision,
            footprint:
              read.footprint === undefined ? null : brief(read.footprint),
          })),
        pinned:
          internalsOf(instance.view)?.kind === "pin" && instance.data !== null,
      });
    for (const wave of waves) {
      for (const instance of wave.evaluated) add(instance);
      for (const instance of wave.pinned.evaluated) add(instance);
    }
    return instances;
  };

  /** Calls `call`, tracing what it answers or throws as settling `of`. */
  const settle = <T>(
    of: number,
    call: () => T,
    answered: (
      answer: Awaited<T>,
    ) => Pick<Settled, "summary" | "instances" | "payload">,
  ): T => {
    const started = performance.now();
    const took = (): number => Math.round(performance.now() - started);
    const failed = (error: unknown): void =>
      void emit({
        kind: "settled",
        of,
        failed: true,
        took: took(),
        summary: messageOf(error),
        instances: null,
        payload: { error: messageOf(error) },
      });
    const ok = (answer: Awaited<T>): void =>
      void emit({
        kind: "settled",
        of,
        failed: false,
        took: took(),
        ...answered(answer),
      });
    let answer: T;
    try {
      answer = call();
    } catch (error) {
      failed(error);
      throw error;
    }
    if (answer instanceof Promise) {
      answer.then((settled) => ok(settled as Awaited<T>), failed);
    } else {
      ok(answer as Awaited<T>);
    }
    return answer;
  };

  /** The pass a query launched now, at `revision`, runs in: the open one, or a new one. */
  const passAt = (revision: number): number => {
    if (open?.revision === revision) return open.seq;
    // A pass launches its queries at once: the next task's are another pass's.
    if (open === undefined) queueMicrotask(() => (open = undefined));
    open = { seq: emit({ kind: "pass", revision }), revision };
    return open.seq;
  };

  const ran = (
    result: QueryResult<unknown>,
  ): Pick<Settled, "summary" | "instances" | "payload"> => {
    const instances = instancesOf(result);
    return {
      summary: plural(instances.length, "instance"),
      instances,
      payload: null,
    };
  };

  const traced = <O, I, F>(
    driver: QueryDriver<O, I, F>,
    immediate: boolean,
  ): QueryDriver<O, I, F> => ({
    start(args) {
      const of = emit({
        kind: "query",
        parent: reader ?? passAt(args.context.revision),
        restart: false,
        immediate,
        roots: args.roots.map(refLabel),
        hits: [],
      });
      return settle(of, () => driver.start(args), ran);
    },
    restart(args) {
      const of = emit({
        kind: "query",
        parent: passAt(args.context.revision),
        restart: true,
        immediate,
        roots: args.descriptor.roots.map(refLabel),
        hits: args.invalidated.stale.map(hitOf),
      });
      return settle(of, () => driver.restart(args), ran);
    },
  });

  const answered = (
    answer: unknown,
  ): Pick<Settled, "summary" | "instances" | "payload"> => ({
    summary: answer === undefined ? "done" : "answered",
    instances: null,
    payload: { answer: describe(answer, options) },
  });

  /** What an action `parent` runs in; `null` outside any. */
  const scopeOf = (parent: number | null): ActionScope => ({
    action(name, args, call) {
      const via = parent === null ? delivering : undefined;
      delivering = undefined;
      const of = emit({
        kind: "action",
        parent,
        label: labelOf(name, args),
        args: describe(args, options),
        inputs: null,
        remote: false,
        via: via ?? null,
      });
      return settle(of, () => call(scopeOf(of)), answered);
    },
    read(call) {
      if (parent === null) return call();
      const previous = reader;
      reader = parent;
      try {
        return call();
      } finally {
        reader = previous;
      }
    },
    remote(ref, inputs, call) {
      const { action, args } = decoded(ref);
      const of = emit({
        kind: "action",
        parent,
        label: labelOf(action, args),
        args: describe(args, options),
        inputs: describe(inputs, options),
        remote: true,
        via: null,
      });
      return settle(
        of,
        () => {
          const previous = carrying;
          carrying = of;
          try {
            return call();
          } finally {
            carrying = previous;
          }
        },
        answered,
      );
    },
  });
  const scope = scopeOf(null);

  return {
    scope,
    feed: (feed) => ({
      subscribe: (listener) =>
        feed.subscribe((changes, revision) => {
          emit(
            { kind: "revision", revision, changes: changes.map(changeOf) },
            revision,
          );
          listener(changes, revision);
        }),
    }),
    runtime(runtime) {
      const run = <O, I, F>(args: QueryArgs<O, I, F>) =>
        runtime.run({
          ...args,
          driver: traced(args.driver, args.immediate === true),
        });
      const query: Runtime["query"] = (view, args, driver) =>
        Promise.resolve(run({ driver, roots: [runtime.root(view, args)] }));
      const immediateQuery: Runtime["immediateQuery"] = (view, args, driver) =>
        run({ driver, roots: [runtime.root(view, args)], immediate: true });
      const wrapped: Partial<Runtime> = { run, query, immediateQuery };
      return new Proxy(runtime, {
        get: (target, key, receiver) =>
          Object.hasOwn(wrapped, key)
            ? Reflect.get(wrapped, key)
            : Reflect.get(target, key, receiver),
      });
    },
    call: (name, args, call) => scope.action(name, args, () => call()),
    wire(peer, direction, summary, message, failed) {
      const key = `${peer}:${direction}`;
      const n = (wired.get(key) ?? 0) + 1;
      wired.set(key, n);
      if (direction === "in") {
        if (delivering === undefined)
          queueMicrotask(() => (delivering = undefined));
        delivering = { peer, n };
      }
      emit({
        kind: "wire",
        peer,
        direction,
        n,
        summary,
        payload: describe(message, options),
        failed,
        carries: direction === "out" ? carrying ?? null : null,
      });
      // One message carries the action.
      if (direction === "out") carrying = undefined;
    },
  };
}

/** What a message to the host asks, in one line. */
export function summarizeToHost(message: ToHost): string {
  if (message.type === "query") {
    return `query ${message.queries
      .map(
        (query) =>
          `${labelOf(query.view, query.args)} [${query.tags.join(", ")}]`,
      )
      .join(", ")}`;
  }
  if (message.type === "release") return `release ${message.keys.length}`;
  return `run ${decodeActionRef(message.ref).action}`;
}

/** What a message from the host answers, in one line: each query's result, by its root. */
export function summarizeFromHost(message: FromHost): string {
  if (message.type === "rejected") return `rejected: ${message.message}`;
  if (message.type === "ran") return "ran";
  return message.results
    .map((result) => {
      const root = rootOfKey(result.key);
      return result.type === "failed"
        ? `failed ${root}: ${result.message}`
        : `${result.type} ${root} · ${plural(
            result.answers.length,
            "instance",
          )}`;
    })
    .join(", ");
}

/** A query's root view, by its key: `queryKey(view, args, tags)`. */
function rootOfKey(key: string): string {
  try {
    const [view]: unknown[] = JSON.parse(key);
    return typeof view === "string" ? view : key;
  } catch {
    return key;
  }
}

/** Whether a message from the host says something failed. */
export const failedFromHost = (message: FromHost): boolean =>
  message.type === "rejected" ||
  (message.type === "results" &&
    message.results.some((result) => result.type === "failed"));
