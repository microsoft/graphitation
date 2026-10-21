/**
 * A React integration over a runtime: each `useQuery` runs a query and keeps it live, and
 * `useData` reads an instance a query brought, by the ref a component received. Components
 * receive refs of both kinds encoded, as another runtime would: the client encodes the
 * runtime's own as it takes an instance in, and other runtimes' arrive encoded, so a
 * component reads, keys and runs either the same way. Every instance is kept by id, so
 * components re-render only when their own instance changes.
 */
import {
  Component,
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type {
  Action,
  AnyActionRef,
  AnyRef,
  ChangeFeed,
  External,
  ExternalActionRef,
  ExternalRef,
  FollowedRef,
  QueryDriver,
  QueryResult,
  QuerySubscription,
  ReadonlyResult,
  Ref,
  RefMeta,
  Runtime,
  RunResult,
  ViewInstance,
  ViewInstanceId,
} from "../../../src/index";
import { isActionRef, isViewRef } from "../../../src/views/ref";
import type { InputsParams, RunFn } from "./actions";
import type { SimpleDriverOutput } from "./driver";
import { stableJson } from "./protocol";

/** The meta of a ref its parent's query follows, so its component renders without a query of its own. */
export const render: RefMeta = { tags: ["render"] };

/**
 * A ref as a component receives it from the runtime's rendered query: the id of the
 * instance it leads to. Equal refs are equal strings, so it is the instance's React key too.
 */
export type DataRef<Result> = ExternalRef<Result, unknown>;

type Run = RunResult<SimpleDriverOutput, never, never>;

/** An instance as a component reads it: its value, refs of both kinds encoded, and its failures. */
type Encoded = { readonly value: unknown; readonly errors: readonly string[] };

/** Another runtime's instances, as a remote store holds them: encoded by that runtime. */
export type ClientRemote = {
  /** The instance `ref` names: the same object until `feed` announces a change to it. */
  answer(ref: string | number): Encoded | undefined;

  /** Announces the instances whose answers changed: each change's `value` is the ref. */
  readonly feed: ChangeFeed;
};

export type ClientArgs = {
  readonly runtime: Runtime;

  /** Runs every query: a simple driver following `render`, as `createSimpleDriver(["render"])`. */
  readonly driver: QueryDriver<SimpleDriverOutput, never, never>;

  /** The other runtimes whose refs components receive, in the runtime's data or in theirs. */
  readonly remotes?: readonly ClientRemote[];

  /** How long a query nothing renders stays live, in milliseconds. Defaults to 10 s. */
  readonly grace?: number;
};

type Entry = {
  readonly id: ViewInstanceId;
  readonly root: Ref;
  status: "pending" | "ready" | "failed";
  /** Settles, never rejects, once the first run did. */
  promise: Promise<void>;
  error: Error | undefined;
  /** How many mounted components render it. */
  retained: number;
  timer: ReturnType<typeof setTimeout> | undefined;
  subscription: QuerySubscription | undefined;
  /** Every instance its runs reached. */
  readonly instances: Set<ViewInstanceId>;
  disposed: boolean;
};

/** An instance the runtime ran: as it ran it, as components read it, and the action refs it offers. */
type Kept = {
  readonly instance: ViewInstance;
  readonly encoded: Encoded;
  /** The keys of the action refs `encoded` holds, one per occurrence. */
  readonly actions: readonly string[];
};

type Snapshot = Encoded | "pending" | "failed" | undefined;

type Handler = (event: unknown) => void;

export type Client = {
  readonly runtime: Runtime;

  /** Starts the query from `root` in the pending pass, kept for the grace period. */
  preload(root: Ref): void;

  /** The runtime's own action ref an encoded one stands for; `undefined` for another runtime's. */
  action(ref: string | number): AnyActionRef | undefined;

  /**
   * The event handler running the runtime's own action ref an encoded one stands for, with
   * the event as its action's third parameter: the same one while a kept view offers it.
   */
  handler(ref: string | number, run: AnyRunFn): Handler;

  /** @internal */ readonly entry: (root: Ref) => Entry;
  /** @internal */ readonly retain: (id: ViewInstanceId) => () => void;
  /** @internal */ readonly listen: (
    id: string,
    listener: () => void,
  ) => () => void;
  /** @internal */ readonly snapshot: (id: string) => Snapshot;
};

function ignore(): void {}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function outputOf(
  result: QueryResult<SimpleDriverOutput, never, never>,
): SimpleDriverOutput {
  return "output" in result ? result.output : result.initialResult.output;
}

function isPlain(value: object): boolean {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function createClient({
  runtime,
  driver,
  remotes = [],
  grace = 10_000,
}: ClientArgs): Client {
  const entries = new Map<ViewInstanceId, Entry>();
  const kept = new Map<ViewInstanceId, Kept>();
  const holders = new Map<ViewInstanceId, number>();
  const listeners = new Map<string, Set<() => void>>();
  /** The runtime's action refs components hold encoded, with how many kept occurrences hold each. */
  const actions = new Map<
    string,
    {
      readonly ref: AnyActionRef;
      holders: number;
      handler: Handler | undefined;
    }
  >();

  const idOf = (ref: AnyRef): ViewInstanceId =>
    runtime.codec.instanceKey(ref.view, ref.args);

  const actionKeyOf = (ref: AnyActionRef): string => {
    const id = runtime.codec.actionKey(ref.action);
    return `${id.length}:${id}${runtime.codec.actionArgsKey(
      ref.action,
      ref.args,
    )}`;
  };

  /** `value` with every ref encoded, copied only where something changed. */
  const encode = (value: unknown, offered: string[]): unknown => {
    if (typeof value !== "object" || value === null) return value;
    if (isViewRef(value)) return idOf(value);
    if (isActionRef(value)) {
      const key = actionKeyOf(value);
      offered.push(key);
      const held = actions.get(key);
      if (held === undefined)
        actions.set(key, { ref: value, holders: 1, handler: undefined });
      else held.holders++;
      return key;
    }
    if (Array.isArray(value)) {
      let copy: unknown[] | undefined;
      for (let i = 0; i < value.length; i++) {
        const item: unknown = value[i];
        const encoded = encode(item, offered);
        if (encoded !== item) (copy ??= value.slice())[i] = encoded;
      }
      return copy ?? value;
    }
    if (value instanceof Map) {
      let changed = false;
      const copy = new Map<unknown, unknown>();
      for (const [key, item] of value as Map<unknown, unknown>) {
        const encodedKey = encode(key, offered);
        const encoded = encode(item, offered);
        changed ||= encodedKey !== key || encoded !== item;
        copy.set(encodedKey, encoded);
      }
      return changed ? copy : value;
    }
    if (value instanceof Set) {
      let changed = false;
      const copy = new Set<unknown>();
      for (const item of value as Set<unknown>) {
        const encoded = encode(item, offered);
        changed ||= encoded !== item;
        copy.add(encoded);
      }
      return changed ? copy : value;
    }
    if (!isPlain(value)) return value;
    let copy: Record<string, unknown> | undefined;
    for (const [key, item] of Object.entries(value)) {
      const encoded = encode(item, offered);
      if (encoded !== item) (copy ??= { ...value })[key] = encoded;
    }
    return copy ?? value;
  };

  const release = (offered: readonly string[]): void => {
    for (const key of offered) {
      const held = actions.get(key);
      if (held === undefined) continue;
      if (--held.holders === 0) actions.delete(key);
    }
  };

  const keep = (instance: ViewInstance): Kept => {
    const offered: string[] = [];
    const value = encode(instance.data, offered);
    const errors = instance.errors.map((error) => error.message);
    return { instance, encoded: { value, errors }, actions: offered };
  };

  const notify = (ids: Iterable<string>): void => {
    for (const id of ids)
      for (const listener of listeners.get(id) ?? []) listener();
  };

  for (const remote of remotes) {
    remote.feed.subscribe((changes) =>
      notify(changes.map((change) => String(change.value))),
    );
  }

  const merge = (entry: Entry, output: SimpleDriverOutput): void => {
    if (entry.disposed) return;
    const changed: ViewInstanceId[] = [];
    for (const [id, incoming] of output.instances) {
      if (!entry.instances.has(id)) {
        entry.instances.add(id);
        holders.set(id, (holders.get(id) ?? 0) + 1);
      }
      const existing = kept.get(id);
      if (existing?.instance === incoming) continue;
      // Runs settle out of order: an older one never replaces what a newer one ran.
      if (
        existing !== undefined &&
        existing.instance.revision > incoming.revision
      )
        continue;
      // Encoded first, so an action ref both hold stays registered.
      kept.set(id, keep(incoming));
      if (existing !== undefined) release(existing.actions);
      changed.push(id);
    }
    notify(changed);
  };

  const dispose = (entry: Entry): void => {
    if (entry.disposed) return;
    entry.disposed = true;
    entries.delete(entry.id);
    if (entry.timer !== undefined) clearTimeout(entry.timer);
    entry.subscription?.unsubscribe();
    for (const id of entry.instances) {
      const count = (holders.get(id) ?? 1) - 1;
      if (count > 0) {
        holders.set(id, count);
        continue;
      }
      holders.delete(id);
      const existing = kept.get(id);
      kept.delete(id);
      if (existing !== undefined) release(existing.actions);
    }
  };
  const fail = (entry: Entry, error: unknown): void => {
    if (entry.disposed) return;
    entry.status = "failed";
    entry.error = asError(error);
    entry.subscription?.unsubscribe();
    entry.subscription = undefined;
    notify([entry.id]);
  };

  const settle = (entry: Entry, result: Run): void => {
    // Never subscribed: the runtime lets the run go.
    if (entry.disposed) return;
    merge(entry, outputOf(result));
    entry.status = "ready";
    notify([entry.id]);
    entry.subscription = result.subscribe({
      next: (restart) => merge(entry, outputOf(restart)),
      error: (error) => fail(entry, error),
    });
  };

  /** Lets the entry go after the grace period, unless something renders it by then. */
  const schedule = (entry: Entry): void => {
    if (entry.timer !== undefined) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      entry.timer = undefined;
      if (entry.retained === 0) dispose(entry);
    }, grace);
  };

  const start = (root: Ref): Entry => {
    const entry: Entry = {
      id: idOf(root),
      root,
      status: "pending",
      promise: Promise.resolve(),
      error: undefined,
      retained: 0,
      timer: undefined,
      subscription: undefined,
      instances: new Set(),
      disposed: false,
    };
    entries.set(entry.id, entry);
    schedule(entry);
    try {
      // Not immediate: the run joins the pending pass, so it always settles later.
      entry.promise = Promise.resolve(
        runtime.run({ driver, roots: [root] }),
      ).then(
        (result) => settle(entry, result),
        (error: unknown) => fail(entry, error),
      );
    } catch (error) {
      fail(entry, error);
    }
    return entry;
  };

  const entry = (root: Ref): Entry => {
    const existing = entries.get(idOf(root));
    if (existing === undefined) return start(root);
    // A failure nothing renders any more is retried.
    if (existing.status === "failed" && existing.retained === 0) {
      dispose(existing);
      return start(root);
    }
    return existing;
  };

  return {
    runtime,
    preload(root) {
      entry(root);
    },
    action: (ref) => actions.get(String(ref))?.ref,
    handler(ref, run) {
      const held = actions.get(String(ref));
      if (held === undefined)
        throw new Error("Only the runtime's own action refs handle events");
      return (held.handler ??= (event) => run(held.ref, undefined, event));
    },
    entry,
    retain(id) {
      const retained = entries.get(id);
      if (retained === undefined) return ignore;
      retained.retained++;
      if (retained.timer !== undefined) clearTimeout(retained.timer);
      retained.timer = undefined;
      return () => {
        retained.retained--;
        if (retained.retained === 0) schedule(retained);
      };
    },
    listen(id, listener) {
      let set = listeners.get(id);
      if (set === undefined) listeners.set(id, (set = new Set()));
      set.add(listener);
      return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(id);
      };
    },
    snapshot(id) {
      const queried = entries.get(id);
      if (queried !== undefined && queried.status !== "ready")
        return queried.status;
      const own = kept.get(id);
      if (own !== undefined) return own.encoded;
      for (const remote of remotes) {
        const answer = remote.answer(id);
        if (answer !== undefined) return answer;
      }
      return undefined;
    },
  };
}

/** `run` as the context keeps it: React context carries no services. */
type AnyRunFn = (
  ref: AnyActionRef | ExternalActionRef<Action, never>,
  inputs?: object,
  event?: unknown,
) => void;

/** What the event handler for an action ref receives: its action's third parameter. */
type EventOf<A> = A extends (
  args: never,
  context: never,
  event: infer Event,
) => unknown
  ? Event
  : unknown;

type HandlerFn = {
  <A extends Action, Inputs extends object>(
    ref: ExternalActionRef<A, Inputs>,
    ...inputs: InputsParams<Inputs>
  ): (event: EventOf<A>) => void;
  /** None for no ref: an action a view offers only at times. */
  <A extends Action, Inputs extends object>(
    ref: ExternalActionRef<A, Inputs> | null,
    ...inputs: InputsParams<Inputs>
  ): ((event: EventOf<A>) => void) | undefined;
};

type Context = {
  readonly client: Client;
  readonly run: AnyRunFn;
  readonly handler: HandlerFn;
};

const DataContext = createContext<Context | undefined>(undefined);

function useDataContext(): Context {
  const context = useContext(DataContext);
  if (context === undefined)
    throw new Error("Render this below a DataProvider");
  return context;
}

export function DataProvider<Services>({
  client,
  run,
  children,
}: {
  readonly client: Client;
  readonly run: RunFn<Services>;
  readonly children: ReactNode;
}): ReactNode {
  const value = useMemo((): Context => {
    const anyRun = run as AnyRunFn;
    const handler = ((
      ref: string | number | null,
      inputs?: object,
    ): Handler | undefined => {
      if (ref === null) return undefined;
      if (inputs === undefined) return client.handler(ref, anyRun);
      // A new one each render, bound now, so a wrong input throws to the nearest boundary.
      const own = client.action(ref);
      if (own === undefined)
        throw new Error("Only the runtime's own action refs handle events");
      const bound = client.runtime.bind(own, inputs);
      return (event) => anyRun(bound, undefined, event);
    }) as HandlerFn;
    return { client, run: anyRun, handler };
  }, [client, run]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

/**
 * Makes event handlers: `handler(ref)` runs the runtime's own action ref a component
 * received, with the event as its action's third parameter. The same handler while a view
 * offers the ref, so one made in a loop or on every render changes nothing.
 * `handler(ref, inputs)` binds the inputs the ref leaves open, and makes a new handler
 * each time. A wrong input, or another runtime's ref, throws to the nearest `DataBoundary`.
 */
export function useHandler(): HandlerFn {
  return useDataContext().handler;
}

/**
 * Runs an action ref as an effect: once mounted, and again only when the ref or its
 * inputs differ. Binds the runtime's own during render, so a missing input throws to the
 * nearest `DataBoundary`.
 */
export function useActionEffect<A extends Action, Inputs extends object>(
  ref: ExternalActionRef<A, Inputs>,
  ...inputs: InputsParams<Inputs>
): void {
  const { client, run } = useDataContext();
  const own = client.action(ref);
  if (own !== undefined) client.runtime.bind(own, inputs[0]);
  const key = `${String(ref)}${stableJson(inputs[0] ?? null)}`;
  // `inputs` are new on every render; `key` changes only with what it runs.
  useEffect(() => run(ref, inputs[0]), [run, key]);
}

function dataOf(encoded: Encoded): unknown {
  if (encoded.value === null && encoded.errors.length > 0) {
    throw new Error(encoded.errors.join("\n"));
  }
  return encoded.value;
}

function useInstance(client: Client, id: string): Snapshot {
  const subscribe = useCallback(
    (listener: () => void) => client.listen(id, listener),
    [client, id],
  );
  const snapshot = useCallback(() => client.snapshot(id), [client, id]);
  return useSyncExternalStore(subscribe, snapshot);
}

/**
 * Runs a query from `ref` and keeps it live while the component is mounted. Suspends
 * until its first run settles; throws its failure to the nearest `DataBoundary`. Refs in
 * its result come encoded.
 */
export function useQuery<Result>(
  ref: Ref<Result>,
): ReadonlyResult<External<Result, unknown>> {
  const { client } = useDataContext();
  const entry = client.entry(ref);
  useEffect(() => client.retain(entry.id), [client, entry.id]);
  const snapshot = useInstance(client, entry.id);
  if (snapshot === "pending") throw entry.promise;
  if (snapshot === "failed") throw entry.error ?? new Error("The query failed");
  if (snapshot === undefined) throw entry.promise;
  return dataOf(snapshot) as ReadonlyResult<External<Result, unknown>>;
}

type ResultOfRef<R> = R extends ExternalRef<infer Result, infer _Followed>
  ? Result
  : never;
type FollowedOfRef<R> = R extends ExternalRef<infer _Result, infer Followed>
  ? Followed
  : never;

/**
 * Reads the instance a ref a component received leads to: one the runtime's rendered
 * query followed, as a ref made with `render` meta, or one another runtime's followed.
 */
export function useData<R extends FollowedRef>(
  ref: R,
): ReadonlyResult<External<ResultOfRef<R>, FollowedOfRef<R>>> {
  const { client } = useDataContext();
  const id = String(ref);
  const snapshot = useInstance(client, id);
  if (snapshot === undefined || typeof snapshot === "string") {
    throw new Error(
      `Not followed: ${id}. Make its ref with \`render\` meta, follow it in its query, or use useQuery`,
    );
  }
  return dataOf(snapshot) as ReadonlyResult<
    External<ResultOfRef<R>, FollowedOfRef<R>>
  >;
}

type BoundaryProps = {
  readonly fallback: ReactNode;
  readonly failure: (error: Error, retry: () => void) => ReactNode;
  readonly children: ReactNode;
};

class ErrorBoundary extends Component<
  BoundaryProps,
  { readonly error: Error | undefined }
> {
  override state = { error: undefined as Error | undefined };

  static getDerivedStateFromError(error: unknown): { readonly error: Error } {
    return { error: asError(error) };
  }

  retry = (): void => this.setState({ error: undefined });

  override render(): ReactNode {
    const { error } = this.state;
    return error === undefined
      ? this.props.children
      : this.props.failure(error, this.retry);
  }
}

/** Where a query suspends, and where its failure shows, with a retry. */
export function DataBoundary({
  fallback,
  failure,
  children,
}: BoundaryProps): ReactNode {
  return (
    <ErrorBoundary fallback={fallback} failure={failure}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}
