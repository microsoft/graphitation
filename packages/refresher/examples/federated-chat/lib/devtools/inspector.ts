/**
 * The inspected side of the devtools: lists a runtime's views and stores, runs what the
 * devtools watch, keeping each live until unwatched, runs the action refs results held, and
 * edits stores. Its queries run on the runtime itself, untraced, so they are not activity.
 */
import { view } from "../../../../src/index";
import type {
  AnyActionRef,
  AnyRef,
  AnyView,
  PromiseOrValue,
  QuerySubscription,
  Ref,
  RefMeta,
  RunResult,
  Runtime,
  ViewInstanceId,
} from "../../../../src/index";
import { internalsOf } from "../../../../src/views/definitions";
import { createSimpleDriver } from "../driver";
import type { SimpleDriverOutput } from "../driver";
import { describe, viewName } from "./describe";
import type { DescribeOptions, Encoded } from "./describe";
import type {
  FromInspector,
  Inspector,
  StoreInfo,
  Target,
  ViewInfo,
} from "./protocol";

/** A store the devtools show, and the edits it takes. */
export type InspectedStore = {
  readonly name: string;
  /** Every entry, as `{ key, value }`: a view the inspector runs without arguments. */
  readonly entries: AnyView;
  readonly put?: (key: unknown, value: unknown) => PromiseOrValue<void>;
  /** Adds `value`, its key in it. */
  readonly add?: (value: unknown) => PromiseOrValue<void>;
  readonly delete?: (key: unknown) => PromiseOrValue<void>;
};

export type InspectorArgs = {
  /** The runtime, untraced. */
  readonly runtime: Runtime;
  /** Every view the devtools list. */
  readonly views: Iterable<AnyView>;
  readonly stores?: readonly InspectedStore[];
  /**
   * Runs an action ref a result held, the runtime's own or another runtime's encoded, with
   * values for its open inputs, answering with what its action answered.
   */
  readonly run: (
    ref: AnyActionRef | string,
    inputs: object,
  ) => Promise<unknown>;
  /** What a string in a result names, when it is another runtime's ref or action ref. */
  readonly encoded?: (text: string) => Encoded | undefined;
  readonly send: (message: FromInspector) => void;
};

/** How many refs and action refs the inspector keeps handles for; the oldest go first. */
const HANDLES = 5000;

/** The meta of the ref a reader answers: the driver follows only it. */
const INSPECT: RefMeta = { tags: ["inspect"] };

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** A map's entry, kept as the newest, dropping the oldest beyond `HANDLES`. */
function keep<K, V>(map: Map<K, V>, key: K, value: V): void {
  map.delete(key);
  map.set(key, value);
  if (map.size > HANDLES) map.delete(map.keys().next().value!);
}

type Watch = { subscription: QuerySubscription | undefined; stopped: boolean };

/**
 * Every view in `sources`, as modules and stores hold them: their members, and their
 * members' members, three levels deep.
 */
export function viewsIn(...sources: readonly object[]): AnyView[] {
  const found = new Set<AnyView>();
  const seen = new Set<object>();
  const visit = (value: unknown, depth: number): void => {
    if (
      (typeof value !== "object" && typeof value !== "function") ||
      value === null
    )
      return;
    if (seen.has(value)) return;
    seen.add(value);
    const candidate = value as AnyView;
    if (internalsOf(candidate) !== undefined) {
      found.add(candidate);
      return;
    }
    if (depth === 0 || typeof value === "function") return;
    for (const member of Object.values(value)) visit(member, depth - 1);
  };
  for (const source of sources) visit(source, 3);
  return [...found];
}

export function createInspector({
  runtime,
  views,
  stores = [],
  run,
  encoded,
  send,
}: InspectorArgs): Inspector {
  const { codec } = runtime;
  const driver = createSimpleDriver(["inspect"]);
  const byKey = new Map<string, AnyView>();
  for (const listed of views) byKey.set(codec.viewKey(listed), listed);
  const storesByName = new Map(stores.map((store) => [store.name, store]));

  let handles = 0;
  const refs = new Map<number, AnyRef>();
  const actions = new Map<number, AnyActionRef | string>();
  /** The handle of each ref and action ref kept, by its key. */
  const handleOf = new Map<string, number>();
  const handle = <T>(table: Map<number, T>, key: string, value: T): number => {
    const known = handleOf.get(key);
    if (known !== undefined && table.has(known)) return known;
    const issued = ++handles;
    keep(table, issued, value);
    keep(handleOf, key, issued);
    return issued;
  };
  const plain: DescribeOptions = {
    ref: (ref) =>
      handle(
        refs,
        `ref ${ref.instanceId ?? codec.instanceKey(ref.view, ref.args)}`,
        ref,
      ),
    action: (ref) =>
      handle(
        actions,
        typeof ref === "string"
          ? `encoded ${ref}`
          : `action ${codec.actionKey(ref.action)} ${codec.actionArgsKey(
              ref.action,
              ref.args,
            )}`,
        ref,
      ),
  };
  /** As `plain`, but another runtime's encoded refs marked, to open there. */
  const options: DescribeOptions =
    encoded === undefined ? plain : { ...plain, encoded };

  /** The queryable views reading or referencing each view that is not queryable itself. */
  const readers = new Map<AnyView, AnyView>();
  const readerOf = (target: AnyView, referenced: boolean): AnyView => {
    let reader = readers.get(target);
    if (reader === undefined) {
      reader = view({
        name: `inspect ${viewName(target)}`,
        access: { queryable: true },
        // What it reads may read the clock.
        deterministic: false,
        resolve: (args: unknown, context) =>
          referenced
            ? context.ref(target as never, args as never, INSPECT)
            : context.read(target as never, args as never),
      });
      readers.set(target, reader);
    }
    return reader;
  };

  /** The root a watch runs, and the instance it shows: the target's, or its reader's. */
  const rootOf = (
    target: Target,
  ): { readonly root: Ref; readonly shown: ViewInstanceId } => {
    let shown: AnyView;
    let args: unknown;
    if (target.kind === "view") {
      const found = byKey.get(target.view);
      if (found === undefined)
        throw new Error(`No view goes by ${target.view}`);
      shown = found;
      args = target.args;
    } else if (target.kind === "ref") {
      const ref = refs.get(target.handle);
      if (ref === undefined)
        throw new Error("The ref is no longer kept: run its view again");
      // Its open inputs take their defaults.
      const bound = runtime.bind(ref);
      shown = bound.view;
      args = bound.args;
    } else {
      const store = storesByName.get(target.store);
      if (store === undefined)
        throw new Error(`No store goes by ${target.store}`);
      shown = store.entries;
    }
    // Every definition settles its access: none is left absent.
    const access = shown.access ?? {};
    const direct = runtime.root(shown as never, args as never);
    const id = direct.instanceId;
    if (access.queryable === true) return { root: direct, shown: id };
    if (access.referenceable === true) {
      return {
        root: runtime.root(readerOf(shown, true) as never, args as never),
        shown: id,
      };
    }
    if (access.readable !== true)
      throw new Error(
        `${viewName(shown)} is neither queryable, referenceable nor readable`,
      );
    const root = runtime.root(readerOf(shown, false) as never, args as never);
    return { root, shown: root.instanceId };
  };

  const watches = new Map<string, Watch>();

  const unwatch = (key: string): void => {
    const watch = watches.get(key);
    if (watch === undefined) return;
    watches.delete(key);
    watch.stopped = true;
    watch.subscription?.unsubscribe();
  };

  const watch = (key: string, target: Target): void => {
    unwatch(key);
    const current: Watch = { subscription: undefined, stopped: false };
    watches.set(key, current);
    const failed = (error: unknown): void => {
      if (current.stopped) return;
      watches.delete(key);
      send({ type: "failed", key, message: messageOf(error) });
    };
    try {
      const { root, shown } = rootOf(target);
      // A store's entries stay plain, so they edit as they read.
      const described = target.kind === "store" ? plain : options;
      const answer = (output: SimpleDriverOutput): void => {
        const instance = output.instances.get(shown);
        if (current.stopped || instance === undefined) return;
        send({
          type: "result",
          key,
          value: describe(instance.data, described),
          errors: instance.errors.map((error) => error.message),
        });
      };
      const started = (
        result: RunResult<SimpleDriverOutput, never, never>,
      ): void => {
        if (current.stopped) return;
        answer(
          "output" in result ? result.output : result.initialResult.output,
        );
        current.subscription = result.subscribe({
          next: (restart) =>
            answer(
              "output" in restart
                ? restart.output
                : restart.initialResult.output,
            ),
          error: failed,
        });
      };
      Promise.resolve(runtime.run({ driver, roots: [root] })).then(
        started,
        failed,
      );
    } catch (error) {
      failed(error);
    }
  };

  /** Answers `key` once, with what `call` answered. */
  const answerOnce = (
    key: string,
    call: () => PromiseOrValue<unknown>,
  ): void => {
    Promise.resolve()
      .then(call)
      .then(
        (value) =>
          send({
            type: "result",
            key,
            value: describe(value, options),
            errors: [],
          }),
        (error: unknown) =>
          send({ type: "failed", key, message: messageOf(error) }),
      );
  };

  const list = (): void => {
    const listed: ViewInfo[] = [];
    for (const [key, each] of byKey) {
      const internals = internalsOf(each);
      if (internals === undefined) continue;
      listed.push({
        key,
        name: viewName(each),
        kind: internals.kind,
        store: internals.kind === "store" ? internals.store : null,
        access: Object.entries(each.access ?? {})
          .filter(([, allowed]) => allowed)
          .map(([permission]) => permission),
      });
    }
    const infos: StoreInfo[] = stores.map((store) => ({
      name: store.name,
      put: store.put !== undefined,
      add: store.add !== undefined,
      delete: store.delete !== undefined,
    }));
    send({ type: "listed", views: listed, stores: infos });
  };

  return {
    receive(message) {
      switch (message.type) {
        case "list":
          return list();
        case "watch":
          return watch(message.key, message.target);
        case "unwatch":
          return unwatch(message.key);
        case "run":
          return answerOnce(message.key, () => {
            const ref = actions.get(message.handle);
            if (ref === undefined)
              throw new Error(
                "The action ref is no longer kept: run its view again",
              );
            return run(ref, message.inputs);
          });
        case "edit":
          return answerOnce(message.key, () => {
            const store = storesByName.get(message.store);
            const refused = new Error(
              `${message.store} takes no ${message.operation}`,
            );
            if (message.operation === "put") {
              if (store?.put === undefined) throw refused;
              return store.put(message.entry, message.value);
            }
            if (message.operation === "add") {
              if (store?.add === undefined) throw refused;
              return store.add(message.value);
            }
            if (store?.delete === undefined) throw refused;
            return store.delete(message.entry);
          });
      }
    },
  };
}
