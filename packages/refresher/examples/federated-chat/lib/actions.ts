/**
 * Runs actions, as Refresher does not: a runner calling an action ref's action with a
 * context like a view's, plus `store`, which opens a store's writer, `run`, which runs
 * another runtime's action refs, and the application's services, and taking what it
 * answers. A simplified take on mutations: there is no transaction, so each read is a
 * one-shot query at the latest revision, and each write applies at once.
 */
import { view } from "../../../src/index";
import type {
  Action,
  ActionRefLeaving,
  ActionRefTemplate,
  ActionRefFn,
  ActionResultOf,
  AnyActionRef,
  AnyRef,
  AnyView,
  External,
  ExternalActionRef,
  PromiseOrValue,
  QueryableView,
  QueryResult,
  ReadableView,
  ReadFn,
  RefMeta,
  RootFn,
  Runtime,
  Store,
} from "../../../src/index";
import {
  createActionRef,
  isActionRef,
  isViewRef,
} from "../../../src/views/ref";
import { createSimpleDriver } from "./driver";
import type { SimpleDriverOutput } from "./driver";
import type { Client } from "./react";

/** A store actions write: its members are its store views, and its writer's type rides on it. */
export type WritableStore<Writer = unknown> = Store & {
  /** Type-only carrier; never set at runtime. */
  readonly signature?: { readonly writer: Writer };
};

export type WriterOf<S extends WritableStore> = NonNullable<
  S["signature"]
>["writer"];

/** A store and the writer actions open on it, typed by the store. */
export type StoreWriter = {
  readonly store: WritableStore;
  readonly writer: unknown;
};

export function storeWriter<S extends WritableStore>(
  store: S,
  writer: WriterOf<S>,
): StoreWriter {
  return { store, writer };
}

/** What an action runs with: a view's `read`, `ref` and `action`, `store`, `run`, and the services. */
export type ActionContext<Services> = Services & {
  /** Reads a view as a one-shot query at the latest revision: synchronously, unless it may wait. */
  readonly read: ReadFn;

  /** Outside a view, a ref is a root: only a queryable view's. */
  readonly ref: RootFn;

  readonly action: ActionRefFn;

  /** Opens a store's writer. Writes apply at once. */
  readonly store: <S extends WritableStore>(store: S) => WriterOf<S>;

  /**
   * Runs an action ref another runtime offered, with values for the inputs it leaves open.
   * Answers with what its action answered, as that runtime encodes it; rejects with what it
   * threw.
   */
  readonly run: <A extends Action, Inputs extends object>(
    ref: ExternalActionRef<A, Inputs>,
    ...inputs: InputsParams<Inputs>
  ) => Promise<External<Awaited<ActionResultOf<A>>>>;
};

/**
 * What an action answers with: a ref, which the runner preloads, an action ref, which it
 * runs next, or nothing.
 */
export type ActionAnswer = AnyRef | AnyActionRef | null | undefined | void;

/**
 * An action that runs with this context; an event handler's also takes the event, as its
 * third parameter.
 */
type ActionWith<Services> = Action &
  ((
    args: never,
    context: ActionContext<Services>,
    event: never,
  ) => PromiseOrValue<ActionAnswer>);

/**
 * Values for an action ref's open inputs, as `bind` takes them: optional when it leaves none
 * open, or none without a default.
 */
export type InputsParams<Inputs> = {} extends Inputs
  ? [inputs?: NoInfer<Inputs>]
  : [inputs: NoInfer<Inputs>];

/**
 * Runs an action ref a view offered, binding the inputs it leaves open to the values its
 * caller has: an external one, another runtime's, by the runner's `remote`.
 */
export type RunFn<Services> = {
  <A extends ActionWith<Services>, Inputs extends object>(
    ref: ActionRefTemplate<A, Inputs>,
    ...inputs: InputsParams<Inputs>
  ): void;
  <A extends Action, Inputs extends object>(
    ref: ExternalActionRef<A, Inputs>,
    ...inputs: InputsParams<Inputs>
  ): void;
};

export type RunnerArgs<Services> = {
  readonly client: Client;

  /** Each store actions write, with its writer. */
  readonly writers: readonly StoreWriter[];

  /** What actions need besides Refresher's context, spread into it. */
  readonly services: Services;

  /**
   * Runs an external action ref, another runtime's, with values for its open inputs,
   * answering with what its action answered. Without it, running one fails.
   */
  readonly remote?: (
    ref: ExternalActionRef<Action, never>,
    inputs: object | undefined,
  ) => Promise<unknown>;

  /** Receives what an action throws or rejects with. */
  readonly report: (error: unknown) => void;

  /** What actions run in, from outside any action: the devtools trace actions by it. */
  readonly scope?: ActionScope;
};

/**
 * What runs an action, and what it does: each call answers what its `call` does. An
 * action's reads, its runs and the action it answers with go through the scope it ran in.
 */
export type ActionScope = {
  /** Runs `call`, an action `name` with `args`, giving it the scope of what it does. */
  action<T>(name: string, args: unknown, call: (scope: ActionScope) => T): T;
  /** Runs `call`, a read. */
  read<T>(call: () => T): T;
  /** Runs `call`, which sends `ref`, another runtime's action ref, with values for its inputs. */
  remote<T>(ref: string, inputs: object | undefined, call: () => T): T;
};

/** Runs everything as it is. */
const plainScope: ActionScope = {
  action: (_name, _args, call) => call(plainScope),
  read: (call) => call(),
  remote: (_ref, _inputs, call) => call(),
};

/**
 * Makes action refs as views and actions do, for whatever has neither: the application's
 * start, say, running the action that opens its first queries.
 */
export function actions(runtime: Runtime): ActionRefFn {
  // The overload types the arguments, which the codec captures whatever they are.
  function action<A extends Action, Inputs>(
    target: A,
    args?: unknown,
    meta?: RefMeta,
  ): ActionRefLeaving<A, Inputs>;
  function action(
    target: Action,
    args?: unknown,
    meta?: RefMeta,
  ): AnyActionRef {
    const captured = runtime.codec.captureActionArgs(target, args);
    runtime.codec.actionArgsKey(target, captured);
    return createActionRef(target, captured, meta);
  }
  return action;
}

function valueOf(
  result: QueryResult<SimpleDriverOutput, never, never>,
): unknown {
  const output =
    "output" in result ? result.output : result.initialResult.output;
  const instance = output.roots[0]!;
  if (instance.data === null && instance.errors.length > 0) {
    throw new Error(instance.errors.map((error) => error.message).join("\n"));
  }
  return instance.data;
}

/** Calls each action on the main thread, at once. */
export function createRunner<Services>({
  client,
  writers,
  services,
  remote = () =>
    Promise.reject(new Error("No runtime runs external action refs")),
  report,
  scope: root = plainScope,
}: RunnerArgs<Services>): RunFn<Services> {
  const { runtime } = client;
  const driver = createSimpleDriver();
  const opened = new Map<WritableStore, unknown>(
    writers.map(({ store, writer }) => [store, writer]),
  );
  /** The queryable view reading each view an action read, so a one-shot query can start from it. */
  const readers = new Map<AnyView, QueryableView>();
  const readerOf = (target: ReadableView): QueryableView => {
    let reader = readers.get(target);
    if (reader === undefined) {
      reader = view({
        name: `read ${target.name ?? "view"}`,
        access: { queryable: true },
        resolve: (args: unknown, { read }) => read(target, args),
      });
      readers.set(target, reader);
    }
    return reader;
  };

  const read = (target: ReadableView, args?: unknown): unknown => {
    // At once: a query whose reads all answer synchronously settles synchronously.
    const result = runtime.immediateQuery(readerOf(target), args, driver);
    return result instanceof Promise ? result.then(valueOf) : valueOf(result);
  };

  const shared = {
    ...services,
    ref: runtime.root,
    action: actions(runtime),
    store<S extends WritableStore>(target: S): WriterOf<S> {
      if (!opened.has(target))
        throw new Error(`No writer for the store ${target.name}`);
      return opened.get(target);
    },
  };

  /** Another runtime's action ref, run in `scope`. */
  const runRemote = (
    scope: ActionScope,
    ref: ExternalActionRef<Action, never>,
    inputs: object | undefined,
  ): Promise<unknown> =>
    scope.remote(String(ref), inputs, () => remote(ref, inputs));

  /** An action's own context: what it does goes through the scope it runs in. */
  const contextIn = (scope: ActionScope): ActionContext<Services> => ({
    ...shared,
    read: (target: ReadableView, args?: unknown) =>
      scope.read(() => read(target, args)),
    run: (ref, ...inputs) => runRemote(scope, ref, inputs[0]) as Promise<never>,
  });

  const run = (
    ref: AnyActionRef,
    inputs: object | undefined,
    event: unknown,
    scope: ActionScope,
  ): void => {
    try {
      const bound: AnyActionRef = runtime.bind(ref, inputs);
      const action: unknown = bound.action;
      if (typeof action !== "function")
        throw new Error("Only functions are actions here");
      // Synchronously, so an event handler's action may still prevent the event's default.
      scope.action(action.name, bound.args, (own) => {
        const answered: unknown = action(bound.args, contextIn(own), event);
        if (answered instanceof Promise)
          answered.then((answer) => take(answer, own), report);
        else take(answered, own);
        return answered;
      });
    } catch (error) {
      report(error);
    }
  };

  /** Takes what an action answered, in the scope it ran in. */
  const take = (answered: unknown, scope: ActionScope): void => {
    try {
      // An answer leaving inputs open takes their defaults: nothing here has values for them.
      if (isActionRef(answered)) {
        run(answered, undefined, undefined, scope);
      } else if (isViewRef(answered)) {
        client.preload(runtime.bind(answered));
      }
    } catch (error) {
      report(error);
    }
  };

  // A third argument, an event, goes on to the runtime's own action as its third parameter:
  // the event a handler `useHandler` made was called with. Another runtime's never takes one.
  return (
    ref: AnyActionRef | ExternalActionRef<Action, never>,
    inputs?: object,
    event?: unknown,
  ): void => {
    if (typeof ref === "object") return run(ref, inputs, event, root);
    // Encoded: the runtime's own as components hold them, or another runtime's.
    const own = client.action(ref);
    if (own !== undefined) run(own, inputs, event, root);
    else runRemote(root, ref, inputs).catch(report);
  };
}
