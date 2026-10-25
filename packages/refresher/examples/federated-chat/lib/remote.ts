/**
 * The asking side of federation: a remote store, whose store views read another session's
 * views, and its connection, which talks to that session's host. See
 * docs/architecture/federation.md#reading-another-sessions-views.
 */
import { storeView } from "../../../src/index";
import type {
  Action,
  AnyView,
  ArgsOf,
  ChangeFeed,
  ExternalActionRef,
  ExternalRef,
  ExternalRefFor,
  FollowedRef,
  QueryableView,
  Revision,
  StoreChange,
  StoreChangeListener,
  StoreName,
  StoreView,
  ViewId,
} from "../../../src/index";
import { encodeRef, queryKey, stableJson } from "./protocol";
import type {
  Answer,
  EncodedRef,
  FromHost,
  RemoteQuery,
  RemoteResult,
  ToHost,
  Unstamped,
} from "./protocol";

/** What a remote store's views read through: the connection's state. */
export type RemoteHandle = {
  /** The value of an instance some query brought, while the store holds it. Throws for any other. */
  instance(ref: EncodedRef): unknown;
  /** The revision the store stopped observing the instance at; `undefined` while a live query brings it. */
  stoppedAt(ref: EncodedRef): Revision | undefined;
  /** Whether a query with the root `ref` names has not answered yet. */
  opening(ref: EncodedRef): boolean;
  /** Every answer the store holds, live or kept stale, by its encoded ref: for tools that list them. */
  entries(): readonly RemoteEntry[];
};

/** An answer a remote store holds, as `entries` lists it. */
export type RemoteEntry = {
  readonly key: EncodedRef;
  readonly value: {
    readonly value: unknown;
    readonly errors: readonly string[];
    readonly stale: boolean;
  };
};

/**
 * A query from another session's view, its runtime following `tags` beneath the root. Not a
 * view, so no view reads it: only a connection's `open` starts it. Its answers hold external
 * refs, followed as `Followed` says.
 */
export type ExternalQuery<V extends QueryableView, Followed = never> = {
  readonly id: ViewId;
  readonly tags: readonly string[];
  /** Type-only carrier; never set at runtime. */
  readonly signature?: { readonly view: V; readonly followed: Followed };
};

export type RemoteStore = {
  readonly name: StoreName;

  /**
   * The query from the other session's view `id`, following `tags` beneath its root.
   * `Followed` is the union of results the tags reach: a promise the types take on trust,
   * which reading a ref the query did not bring fails at runtime.
   */
  external<V extends QueryableView, Followed = never>(
    id: ViewId,
    tags?: readonly string[],
  ): ExternalQuery<V, Followed>;

  /** The external ref to the other session's view `id` for `args`, as its answers hold it. */
  ref<V extends AnyView>(id: ViewId, args: ArgsOf<V>): ExternalRefFor<V>;

  /**
   * Every instance the store's open queries brought, keyed by its external ref:
   * `read(views, ref)` answers the result of the instance `ref` names, typed by the ref, at
   * once. Only a ref its query followed reads.
   */
  readonly views: StoreView<
    FollowedRef,
    unknown,
    Record<string, never>,
    unknown
  >;

  /**
   * Whether a query whose root `ref` names is on its way: opened or reopened, it has not
   * answered yet, nor been closed. Its root may read meanwhile, stale, if `reopen` answered
   * with it.
   */
  readonly opening: StoreView<
    ExternalRef,
    boolean,
    Record<string, never>,
    unknown
  >;

  /** Every answer the store holds, by its encoded ref: for tools that list them. */
  readonly entries: StoreView<
    undefined,
    readonly RemoteEntry[],
    Record<string, never>,
    unknown
  >;
};

/** Declares another session's store. Its handle comes from `connectRemote`. */
export function remoteStore(name: StoreName): RemoteStore {
  // A store view underneath: the instances arrive through the store's handle and feed.
  const views = storeView<FollowedRef, unknown, RemoteHandle>({
    store: name,
    name: `${name} views`,
    id: `${name}/views`,
    resolve: (ref, { store, annotate }) => {
      const key = String(ref);
      const data = store.instance(key);
      const stoppedAt = store.stoppedAt(key);
      // Kept since its last query stopped: stale, as of the store's last look at it.
      return stoppedAt === undefined
        ? data
        : annotate({ data, revision: stoppedAt, footprint: { stoppedAt } });
    },
    // A changed answer, and the store's no longer observing it, hit every read of it. Its
    // observing it again, unchanged, hits only a read it answered stale.
    matches: (ref, change, footprint) =>
      change.value === ref &&
      (change.operation === "answer" ||
        change.operation === "unobserved" ||
        (change.operation === "observed" && footprint !== undefined)),
  });
  const opening = storeView<ExternalRef, boolean, RemoteHandle>({
    store: name,
    name: `${name} opening`,
    id: `${name}/opening`,
    resolve: (ref, { store }) => store.opening(String(ref)),
    matches: (ref, change) =>
      change.operation === "opening" && change.value === ref,
  });
  const entries = storeView<undefined, readonly RemoteEntry[], RemoteHandle>({
    store: name,
    name: `${name} entries`,
    id: `${name}/entries`,
    resolve: (_args, { store }) => store.entries(),
    matches: (_args, change) => change.operation !== "opening",
  });
  return {
    name,
    external: (id, given = []) => ({
      id,
      tags: [...given].sort(),
    }),
    ref<V extends AnyView>(id: ViewId, args: ArgsOf<V>) {
      return encodeRef(id, args) as ExternalRefFor<V>;
    },
    views,
    opening,
    entries,
  };
}

export type ConnectRemoteArgs = {
  readonly send: (message: ToHost) => void;

  /**
   * The runtime's clock, read once its feed took the change saying what the store stopped
   * observing: the revision the store answers those instances stale at. Stamps every
   * message sent too.
   */
  readonly latestRevision: () => Revision;

  /**
   * How many instances no live query brings the store keeps, answering them stale. The ones
   * released longest ago go first, a whole release at a time, but none from the release of
   * a root `reopen` answered with, or later, until its query answers. Defaults to 1000.
   */
  readonly keep?: number;
};

export type RemoteConnection = {
  /** The remote store's handle, for the runtime's `store` function. */
  readonly handle: RemoteHandle;

  /**
   * Announces the instances whose answers changed, and those it stops or starts observing
   * again. Merge it into the runtime's feed: its revisions are its own.
   */
  readonly feed: ChangeFeed;

  /** Hands it a message from the host. */
  receive(message: FromHost): void;

  /**
   * Starts the query, or joins it, and keeps it live until as many `close` calls. Answers
   * with the external ref to its root once the first answer arrived: the store's `views`
   * read the root, and every instance the query brought, at once, until it is closed.
   * Rejects, holding nothing open, if the query or its root fails, or it is closed before
   * its first answer.
   */
  open<V extends QueryableView, Followed>(
    query: ExternalQuery<V, Followed>,
    args: ArgsOf<V>,
  ): Promise<ExternalRefFor<V, Followed>>;

  /**
   * Lets go of one `open` of the query. The last one stops it at once: the host stops it,
   * and the store stops observing every instance only it brought. It says so with a change,
   * which hits what read them, and answers them stale from what it kept until a query brings
   * them again, or `keep` drops them; reading a dropped one fails.
   */
  close<V extends QueryableView, Followed>(
    query: ExternalQuery<V, Followed>,
    args: ArgsOf<V>,
  ): void;

  /**
   * Opens the query again from what the store still holds of it: if the store holds its
   * root's answer, live or kept stale since the query was closed, starts or joins the query
   * in the background, as `open` does, and answers at once with the external ref to its
   * root, which the store's `views` read at once, stale until the query answers, and its
   * `opening` reads `true` meanwhile.
   * `undefined`, opening nothing, if the store holds no answer: `open` it.
   */
  reopen<V extends QueryableView, Followed>(
    query: ExternalQuery<V, Followed>,
    args: ArgsOf<V>,
  ): ExternalRefFor<V, Followed> | undefined;

  /** Whether some live query brought the instance `ref` names. */
  holds(ref: ExternalRef): boolean;

  /**
   * The answer the store holds for the instance `ref` names, live or kept stale, as its
   * query encoded it: the same object until a change to it is announced. `undefined` for any
   * other.
   */
  answer(ref: ExternalRef): Answer | undefined;

  /**
   * Has the host run an action ref its answers offered, with values for the inputs it
   * leaves open. Answers with what the action answered, its refs external; rejects with
   * what it threw.
   */
  run(
    ref: ExternalActionRef<Action, never>,
    inputs: object | undefined,
  ): Promise<unknown>;
};

type Entry = {
  readonly key: string;
  /** The root's encoded ref. */
  readonly ref: EncodedRef;
  status: "pending" | "live";
  readonly ready: Promise<void>;
  resolve(): void;
  reject(error: Error): void;
  /** How many `open` calls it has not been closed for. */
  opened: number;
  /** The keys of every instance it brought. */
  readonly brought: Set<string>;
  /** The release its root was kept from when `reopen` answered with it, until its first answer. */
  reopened: Revision | undefined;
};

function ignore(): void {}

export function connectRemote(
  store: RemoteStore,
  { send: sendStamped, latestRevision, keep = 1000 }: ConnectRemoteArgs,
): RemoteConnection {
  /** Sends a message, stamped with the runtime's latest revision. */
  const send = (message: Unstamped<ToHost>): void =>
    sendStamped({ ...message, revision: latestRevision() });
  const entries = new Map<string, Entry>();
  /** The runs the host has not replied to yet, by id. */
  const running = new Map<
    number,
    { resolve(result: unknown): void; reject(error: Error): void }
  >();
  let runs = 0;
  const values = new Map<string, Answer>();
  /** How many entries brought each instance. */
  const holders = new Map<string, number>();
  /** The instances no live query brings, kept in `values`, by when the store stopped observing them, oldest first. */
  const stopped = new Map<string, Revision>();
  /** How many reopened queries, still before their first answer, read each release. */
  const reopened = new Map<Revision, number>();
  /** How many queries, still before their first answer, have each root. */
  const opening = new Map<string, number>();
  const listeners = new Set<StoreChangeListener>();
  let revision = 0;
  let outbox: RemoteQuery[] | undefined;

  const change = (
    operation: "answer" | "unobserved" | "observed" | "opening",
    key: string,
  ): StoreChange => ({
    store: store.name,
    operation,
    value: key,
  });

  const announce = (changes: readonly StoreChange[]): void => {
    if (changes.length === 0) return;
    revision++;
    for (const listener of listeners) listener(changes, revision);
  };

  const flush = (): void => {
    const queries = outbox ?? [];
    outbox = undefined;
    if (queries.length > 0) send({ type: "query", queries });
  };

  /**
   * Ends a pending entry's opening: lets its reopened release be evicted, and adds to
   * `changes` its root's no longer opening, once no other query with it is. It answered,
   * or is gone.
   */
  const settle = (entry: Entry, changes: StoreChange[]): void => {
    if (entry.status !== "pending") return;
    if (entry.reopened !== undefined) {
      const count = (reopened.get(entry.reopened) ?? 1) - 1;
      if (count > 0) reopened.set(entry.reopened, count);
      else reopened.delete(entry.reopened);
      entry.reopened = undefined;
    }
    const roots = (opening.get(entry.ref) ?? 1) - 1;
    if (roots > 0) {
      opening.set(entry.ref, roots);
    } else {
      opening.delete(entry.ref);
      changes.push(change("opening", entry.ref));
    }
  };

  /**
   * Lets the entry go, and stops observing every instance it alone brought: announces them,
   * so what read them is hit, and keeps them to answer stale, dropping the ones released
   * longest ago beyond `keep`.
   */
  const forget = (entry: Entry): void => {
    entries.delete(entry.key);
    const changes: StoreChange[] = [];
    settle(entry, changes);
    const unobserved = unhold(entry.brought, changes);
    announce(changes);
    stop(unobserved);
  };

  /**
   * One entry fewer brings the instances `keys` names: adds to `changes` that the store
   * stops observing those no entry brings any longer, and answers with their keys.
   */
  const unhold = (keys: Iterable<string>, changes: StoreChange[]): string[] => {
    const unobserved: string[] = [];
    for (const key of keys) {
      const count = (holders.get(key) ?? 1) - 1;
      if (count > 0) {
        holders.set(key, count);
      } else {
        holders.delete(key);
        unobserved.push(key);
        changes.push(change("unobserved", key));
      }
    }
    return unobserved;
  };

  /**
   * Keeps the instances the store stopped observing, once it announced so, to answer stale,
   * dropping the ones released longest ago beyond `keep`. One some entry brought again since
   * is not stopped.
   */
  const stop = (unobserved: readonly string[]): void => {
    if (unobserved.length === 0) return;
    // The runtime took the change at once: its revision is the one the store stopped at,
    // so no stale answer predates the change that hit its readers.
    const at = latestRevision();
    for (const key of unobserved) if (!holders.has(key)) stopped.set(key, at);
    // Whole releases go: an instance stops with the last query bringing it, never before
    // a root that reads it, so a kept root still reads all it brought. A reopened root is
    // read until its query answers, so neither its release nor any later one goes.
    let dropping: Revision | undefined;
    for (const [key, stoppedAt] of stopped) {
      if (stopped.size <= keep && stoppedAt !== dropping) break;
      if (reopened.has(stoppedAt)) break;
      dropping = stoppedAt;
      stopped.delete(key);
      values.delete(key);
    }
  };

  const start = (key: string, query: Omit<RemoteQuery, "key">): Entry => {
    let resolve = ignore;
    let reject: (error: Error) => void = ignore;
    const ready = new Promise<void>((onResolve, onReject) => {
      resolve = onResolve;
      reject = onReject;
    });
    // Rejections reach whoever reads the query; none may be left unhandled.
    ready.catch(ignore);
    const entry: Entry = {
      key,
      ref: encodeRef(query.view, query.args),
      status: "pending",
      ready,
      resolve,
      reject,
      opened: 0,
      brought: new Set(),
      reopened: undefined,
    };
    entries.set(key, entry);
    const roots = opening.get(entry.ref) ?? 0;
    opening.set(entry.ref, roots + 1);
    if (roots === 0) announce([change("opening", entry.ref)]);
    // One message per task, so the queries an event opens start in one pass on the host.
    if (outbox === undefined) {
      outbox = [];
      queueMicrotask(flush);
    }
    outbox.push({ key, ...query });
    return entry;
  };

  /**
   * Takes in one query's result, adding the changes it makes to `changes`, and the keys of
   * the instances the store stops observing for it to `unobserved`.
   */
  const take = (
    result: RemoteResult,
    changes: StoreChange[],
    unobserved: string[],
  ): void => {
    const entry = entries.get(result.key);
    // Released already: what was on its way is of no use.
    if (entry === undefined) return;
    if (result.type === "failed") {
      forget(entry);
      if (entry.status === "pending") entry.reject(new Error(result.message));
      return;
    }
    for (const answer of result.answers) {
      const key = answer.ref;
      if (!entry.brought.has(key)) {
        entry.brought.add(key);
        holders.set(key, (holders.get(key) ?? 0) + 1);
      }
      const kept = stopped.delete(key);
      const previous = values.get(key);
      // An equal answer keeps its object, and reruns only what read it stale.
      const changed =
        previous === undefined || stableJson(previous) !== stableJson(answer);
      if (changed) values.set(key, answer);
      if (changed) changes.push(change("answer", key));
      else if (kept) changes.push(change("observed", key));
    }
    if (result.type === "push") {
      // The query no longer holds them: the host stops observing them for it.
      const dropped = result.dropped.filter((key) => entry.brought.delete(key));
      unobserved.push(...unhold(dropped, changes));
    }
    settle(entry, changes);
    if (entry.status === "pending") {
      entry.status = "live";
      entry.resolve();
    }
  };

  const instance = (ref: EncodedRef): unknown => {
    const answer = values.get(ref);
    if (answer === undefined) {
      throw new Error(`No query brought ${ref}: read it with a query`);
    }
    if (answer.value === null && answer.errors.length > 0)
      throw new Error(answer.errors.join("\n"));
    return answer.value;
  };

  const handle: RemoteHandle = {
    instance,
    stoppedAt: (ref) => stopped.get(ref),
    opening: (ref) => opening.has(ref),
    entries: () =>
      Array.from(values, ([key, answer]) => ({
        key,
        value: {
          value: answer.value,
          errors: answer.errors,
          stale: stopped.has(key),
        },
      })),
  };

  const close = <V extends QueryableView, Followed>(
    query: ExternalQuery<V, Followed>,
    args: ArgsOf<V>,
  ): void => {
    const entry = entries.get(queryKey(query.id, args, query.tags));
    if (entry === undefined) return;
    entry.opened--;
    if (entry.opened > 0) return;
    forget(entry);
    if (entry.status === "pending")
      entry.reject(new Error("Closed before its first answer"));
    send({ type: "release", keys: [entry.key] });
  };

  return {
    handle,
    feed: {
      subscribe(listener) {
        listeners.add(listener);
        listener([], revision);
        return () => {
          listeners.delete(listener);
        };
      },
    },
    receive(message) {
      if (message.type === "ran" || message.type === "rejected") {
        const run = running.get(message.id);
        running.delete(message.id);
        if (message.type === "ran") run?.resolve(message.result);
        else run?.reject(new Error(message.message));
        return;
      }
      // One delivery for the whole message: what one pass there ran, one pass here reruns.
      const changes: StoreChange[] = [];
      const unobserved: string[] = [];
      for (const result of message.results) take(result, changes, unobserved);
      announce(changes);
      stop(unobserved);
    },
    async open<V extends QueryableView, Followed>(
      query: ExternalQuery<V, Followed>,
      args: ArgsOf<V>,
    ): Promise<ExternalRefFor<V, Followed>> {
      const key = queryKey(query.id, args, query.tags);
      const entry =
        entries.get(key) ??
        start(key, { view: query.id, args, tags: query.tags });
      entry.opened++;
      await entry.ready;
      try {
        // Rejects for a failed root, as reading it would fail.
        instance(entry.ref);
      } catch (error) {
        close(query, args);
        throw error;
      }
      return entry.ref as ExternalRefFor<V, Followed>;
    },
    close,
    reopen<V extends QueryableView, Followed>(
      query: ExternalQuery<V, Followed>,
      args: ArgsOf<V>,
    ): ExternalRefFor<V, Followed> | undefined {
      const ref = encodeRef(query.id, args);
      if (!values.has(ref)) return undefined;
      const key = queryKey(query.id, args, query.tags);
      // Its failure reaches the views reading what it brought, not the caller.
      const entry =
        entries.get(key) ??
        start(key, { view: query.id, args, tags: query.tags });
      entry.opened++;
      // Read stale until the query answers: its release stays until then.
      const release = stopped.get(ref);
      if (
        release !== undefined &&
        entry.status === "pending" &&
        entry.reopened === undefined
      ) {
        entry.reopened = release;
        reopened.set(release, (reopened.get(release) ?? 0) + 1);
      }
      return ref as ExternalRefFor<V, Followed>;
    },
    holds(ref) {
      const key = String(ref);
      return values.has(key) && !stopped.has(key);
    },
    answer: (ref) => values.get(String(ref)),
    run(ref, inputs) {
      const id = ++runs;
      return new Promise((resolve, reject) => {
        running.set(id, { resolve, reject });
        send({ type: "run", id, ref: String(ref), inputs });
      });
    },
  };
}
