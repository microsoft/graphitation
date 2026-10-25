/**
 * The answering side of federation: runs the queries another session asks for in a
 * runtime of its own, answers every instance they visit, and pushes what each restart ran,
 * and what it no longer holds, until the query is released. What one pass runs goes in one message, once every query
 * it started or restarted has answered. Runs the action refs its answers offered, when the asking
 * session sends them back. See docs/architecture/federation.md.
 */
import type {
  Action,
  AnyActionRef,
  PromiseOrValue,
  QueryableView,
  QueryDescriptor,
  QueryDriver,
  QuerySubscription,
  Revision,
  Runtime,
  RunResult,
  ViewId,
  ViewInstance,
  ViewInstanceId,
} from "../../../src/index";
import { isOpenInput } from "../../../src/views/input";
import { isActionRef, isViewRef } from "../../../src/views/ref";
import { createSimpleDriver } from "./driver";
import type { SimpleDriverOutput } from "./driver";
import { decodeActionRef, encodeActionRef, encodeRef } from "./protocol";
import type {
  Answer,
  EncodedActionRef,
  EncodedRef,
  FromHost,
  InputMarker,
  RemoteQuery,
  RemoteResult,
  ToHost,
  Unstamped,
} from "./protocol";

export type ServeArgs<A extends Action> = {
  readonly runtime: Runtime;

  /** The views a query may start from, by the id an external view names. */
  readonly published: ReadonlyMap<ViewId, QueryableView>;

  /**
   * The actions answers may offer, by the id an external action ref names: encoding an
   * action ref to any other fails.
   */
  readonly actions: ReadonlyMap<string, A>;

  /** Calls an action with what this session's actions run with, answering with its answer. */
  readonly run: (action: A, args: unknown) => PromiseOrValue<unknown>;

  readonly send: (message: FromHost) => void;
};

export type Host = {
  /** Hands it a message from the asking session. */
  receive(message: ToHost): void;
};

type Run = RunResult<SimpleDriverOutput, never, never>;

type Driver = QueryDriver<SimpleDriverOutput, never, never>;

/** The queries one pass started or restarted, and what they ran so far. */
type Batch = {
  readonly revision: Revision;
  /** The keys of its queries yet to answer. */
  readonly waiting: Set<string>;
  readonly results: RemoteResult[];
  /** The task that launched its queries ended: no more join it. */
  closed: boolean;
};

type LiveQuery = {
  /** The ref the asking session opened it by. */
  readonly ref: EncodedRef;
  /** Every instance its runs visited that it still holds, the latest of each. */
  readonly instances: Map<ViewInstanceId, ViewInstance>;
  /** The query as the runtime keeps it, once restarted: its `views` are what it holds. */
  descriptor: QueryDescriptor | undefined;
  /** The root's instance, once run. Its answers are also sent under `ref`. */
  rootId: ViewInstanceId | undefined;
  subscription: QuerySubscription | undefined;
  released: boolean;
};

function merge(query: LiveQuery, output: SimpleDriverOutput): void {
  for (const [id, instance] of output.instances)
    query.instances.set(id, instance);
}

/** Takes out of `query.instances` those the runtime no longer keeps for it, answering with them. */
function prune(query: LiveQuery): ViewInstance[] {
  const views = query.descriptor?.views;
  const dropped: ViewInstance[] = [];
  if (views === undefined) return dropped;
  for (const [id, instance] of query.instances) {
    if (views.has(id)) continue;
    query.instances.delete(id);
    dropped.push(instance);
  }
  return dropped;
}

/** An action ref's arguments, as plain JSON data: each open input a marker. */
function encodeArgs(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (isOpenInput(value)) {
    return Object.hasOwn(value, "default")
      ? { $input: value.name, default: value.default }
      : { $input: value.name };
  }
  if (isViewRef(value) || isActionRef(value)) {
    throw new Error(
      "An action ref's arguments cross as data: no ref among them",
    );
  }
  if (Array.isArray(value)) return value.map(encodeArgs);
  if (Object.hasOwn(value, "$input")) {
    throw new Error(
      "`$input` marks an open input: an action's arguments hold none",
    );
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, encodeArgs(nested)]),
  );
}

/** `args` with each input marker replaced by the value given for its name, or its default. */
function bindMarkers(args: unknown, inputs: object | undefined): unknown {
  if (args === null || typeof args !== "object") return args;
  if (Array.isArray(args))
    return args.map((nested: unknown) => bindMarkers(nested, inputs));
  if (Object.hasOwn(args, "$input")) {
    const marker = args as InputMarker;
    if (inputs !== undefined && Object.hasOwn(inputs, marker.$input)) {
      return Reflect.get(inputs, marker.$input);
    }
    if (Object.hasOwn(marker, "default")) return marker.default;
    throw new Error(`No value for the input "${marker.$input}"`);
  }
  return Object.fromEntries(
    Object.entries(args).map(([key, nested]) => [
      key,
      bindMarkers(nested, inputs),
    ]),
  );
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export function serve<A extends Action>({
  runtime,
  published,
  actions,
  run,
  send,
}: ServeArgs<A>): Host {
  const { codec } = runtime;
  /** Sends a message, stamped with the runtime's latest revision. */
  const post = (message: Unstamped<FromHost>): void =>
    send({ ...message, revision: runtime.latestRevision() });
  const actionIds = new Map<Action, string>();
  for (const [id, action] of actions) actionIds.set(action, id);
  const live = new Map<string, LiveQuery>();
  const drivers = new Map<string, Driver>();
  /** The batch the queries a pass launches now join. */
  let open: Batch | undefined;
  /** The batch each query answers in, by key, until it does. */
  const batches = new Map<string, Batch>();

  /** Sends a batch, once it is closed and its every query answered. */
  const flush = (batch: Batch): void => {
    if (!batch.closed || batch.waiting.size > 0 || batch.results.length === 0)
      return;
    post({ type: "results", results: batch.results.splice(0) });
  };

  /**
   * The query `key` runs in the pass launching queries now, at `revision`: a pass launches
   * all of its at once, so the queries launched in one task at one revision are one pass.
   */
  const join = (key: string, revision: Revision): void => {
    if (open?.revision !== revision) {
      const batch: Batch = {
        revision,
        waiting: new Set(),
        results: [],
        closed: false,
      };
      open = batch;
      queueMicrotask(() => {
        batch.closed = true;
        if (open === batch) open = undefined;
        flush(batch);
      });
    }
    // Still due in an earlier pass: that run was superseded, so the earlier pass sends without it.
    const earlier = batches.get(key);
    if (earlier !== undefined && earlier !== open) {
      earlier.waiting.delete(key);
      flush(earlier);
    }
    open.waiting.add(key);
    batches.set(key, open);
  };

  /**
   * What the query `key` ran: in its pass's batch, or alone if it runs in none. `null`
   * when it ran nothing to send, or never will.
   */
  const deliver = (key: string, result: RemoteResult | null): void => {
    const batch = batches.get(key);
    if (batch === undefined) {
      if (result !== null) post({ type: "results", results: [result] });
      return;
    }
    batches.delete(key);
    batch.waiting.delete(key);
    if (result !== null) batch.results.push(result);
    flush(batch);
  };

  /** The query's driver, telling the host the pass that runs it, and what the query holds. */
  const tracked = (key: string, query: LiveQuery, driver: Driver): Driver => ({
    start(args) {
      join(key, args.context.revision);
      return driver.start(args);
    },
    restart(args) {
      join(key, args.context.revision);
      query.descriptor = args.descriptor;
      return driver.restart(args);
    },
  });

  const driverFor = (tags: readonly string[]) => {
    const key = tags.join("\n");
    let driver = drivers.get(key);
    if (driver === undefined)
      drivers.set(key, (driver = createSimpleDriver(tags)));
    return driver;
  };

  const encodeRefTo = (view: ViewInstance["view"], args: unknown): EncodedRef =>
    encodeRef(codec.viewKey(view), args);

  const encodeActionRefTo = (ref: AnyActionRef): EncodedActionRef => {
    const id = actionIds.get(ref.action);
    if (id === undefined)
      throw new Error("An answer offers an action published under no id");
    return encodeActionRef(id, encodeArgs(ref.args));
  };

  /** `value` with every ref and action ref in it encoded. Plain JSON data only. */
  const encode = (value: unknown): unknown => {
    if (value === null || typeof value !== "object") return value;
    if (isViewRef(value)) return encodeRefTo(value.view, value.args);
    if (isActionRef(value)) return encodeActionRefTo(value);
    if (Array.isArray(value)) return value.map(encode);
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, encode(nested)]),
    );
  };

  /** An answer per instance, and the root's under the ref the query was opened by too. */
  const answersOf = (
    query: LiveQuery,
    instances: Iterable<ViewInstance>,
  ): Answer[] => {
    const answers: Answer[] = [];
    for (const instance of instances) {
      const ref = encodeRefTo(instance.view, instance.args);
      const value = encode(instance.data);
      const errors = instance.errors.map((error) => error.message);
      answers.push({ ref, value, errors });
      if (instance.id === query.rootId && ref !== query.ref) {
        answers.push({ ref: query.ref, value, errors });
      }
    }
    return answers;
  };

  const fail = (key: string, error: unknown): void => {
    live.delete(key);
    deliver(key, { type: "failed", key, message: messageOf(error) });
  };

  /** Runs the action ref, and replies with what its action answered. */
  const runAction = async (
    ref: EncodedActionRef,
    inputs: object | undefined,
  ): Promise<unknown> => {
    const decoded = decodeActionRef(ref);
    const action = actions.get(decoded.action);
    if (action === undefined)
      throw new Error(`No action goes by ${decoded.action}`);
    return encode(await run(action, bindMarkers(decoded.args, inputs)));
  };

  /** Starts a query: a result now if it cannot, `null` if it answers with its pass. */
  const start = ({
    key,
    view: id,
    args,
    tags,
  }: RemoteQuery): RemoteResult | null => {
    const view = published.get(id);
    if (view === undefined) {
      return {
        type: "failed",
        key,
        message: `No published view goes by ${id}`,
      };
    }
    const query: LiveQuery = {
      ref: encodeRef(id, args),
      instances: new Map(),
      descriptor: undefined,
      rootId: undefined,
      subscription: undefined,
      released: false,
    };
    live.set(key, query);
    // Every query of one message starts in the same pending pass, at one revision.
    runtime.query(view, args, tracked(key, query, driverFor(tags))).then(
      (result) => answer(key, query, result),
      (error: unknown) => fail(key, error),
    );
    return null;
  };

  /** Sends the query's first result, then pushes each restart's until it is released. */
  const answer = (key: string, query: LiveQuery, result: Run): void => {
    // The simple driver delivers each run whole.
    if (query.released || !("output" in result)) return deliver(key, null);
    merge(query, result.output);
    query.rootId = result.output.roots[0]?.id;
    deliver(key, {
      type: "answer",
      key,
      answers: answersOf(query, query.instances.values()),
    });
    query.subscription = result.subscribe({
      next(restart) {
        if (!("output" in restart)) return deliver(key, null);
        merge(query, restart.output);
        // The runtime drops what the restart left behind once it took its result, at once.
        queueMicrotask(() => {
          if (query.released) return;
          deliver(key, {
            type: "push",
            key,
            answers: answersOf(query, restart.output.instances.values()),
            dropped: prune(query).map((instance) =>
              encodeRefTo(instance.view, instance.args),
            ),
          });
        });
      },
      error: (error) => fail(key, error),
    });
  };

  return {
    receive(message) {
      if (message.type === "run") {
        const { id } = message;
        runAction(message.ref, message.inputs).then(
          (result) => post({ type: "ran", id, result }),
          (error: unknown) =>
            post({ type: "rejected", id, message: messageOf(error) }),
        );
        return;
      }
      if (message.type === "release") {
        for (const key of message.keys) {
          const query = live.get(key);
          if (query === undefined) continue;
          live.delete(key);
          query.released = true;
          query.subscription?.unsubscribe();
          // Its run, if any, is aborted: its pass sends without it.
          deliver(key, null);
        }
        return;
      }
      // What the message joined or could not start, in one message; the rest answer with their pass.
      const results: RemoteResult[] = [];
      for (const remote of message.queries) {
        const joined = live.get(remote.key);
        if (joined === undefined) {
          const failed = start(remote);
          if (failed !== null) results.push(failed);
        } else if (joined.subscription !== undefined) {
          results.push({
            type: "answer",
            key: remote.key,
            answers: answersOf(joined, joined.instances.values()),
          });
        }
      }
      if (results.length > 0) post({ type: "results", results });
    },
  };
}
