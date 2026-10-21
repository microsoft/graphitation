/**
 * The store boundary: what a store author writes against. Store views and the context
 * they read in, annotated answers, recorded reads, and the change feed that reports what
 * changed. Most applications read through stores Refresher supplies and never name these.
 *
 * What a store *is* stops at `Store`, `StoreView`, and `ChangeFeed`. A change carries a
 * store to route by, a label to publish, and a payload this file never reads; keys,
 * ranges, filters, and puts belong to whichever store defined them. One such store ships
 * as the separate `@graphitation/refresher/stores` entry point.
 *
 * Written in `./api.core` vocabulary, which never names anything here: views read a store
 * through its store views the way they read any other view. See
 * docs/architecture/stores.md.
 */
import type {
  AccessConfig,
  AccessOf,
  PromiseOrValue,
  Revision,
  Settled,
  StoreName,
  View,
  ViewSchema,
} from "./api.core";

// Stores, as an application sees them

/**
 * A read-only binding to an externally owned store. Declaring one allocates no storage.
 */
export type Store = {
  readonly name: StoreName;
};

/**
 * What a store view that declares nothing carries: the inverse of `DefaultAccess`.
 *
 * A store view is a leaf a derived view reads, not an address an application publishes.
 */
export type DefaultStoreViewAccess = {
  readonly readable: true;
  readonly referenceable: false;
  readonly queryable: false;
};

/**
 * A view over externally owned records. The same access model as any other view,
 * declared the same way under `access`; only the defaults differ.
 */
export type StoreView<
  Args,
  Result,
  Declared = Record<string, never>,
  Answer = PromiseOrValue<Result>,
> = View<Args, Result, AccessOf<Declared, DefaultStoreViewAccess>, Answer>;

// Reads and invalidation

/**
 * A read-visible change, in the only terms the engine has.
 *
 * `store` routes it: reads are grouped by store, so this is addressing rather than
 * description, and it cannot live inside the payload. `operation` is the store's own
 * label for what happened, carried through to a published update and never
 * interpreted. `value` is the store's own payload, opaque here and understood only by
 * that store's views.
 *
 * Deliver every successful change, including external writers. Never report an operation
 * that may still roll back. Notifications describe data, not commands.
 */
export type StoreChange<Payload = unknown> = {
  readonly store: StoreName;
  readonly operation: string;
  readonly value: Payload;
};

/**
 * One delivery from a host: the changes of a single atomic event, stamped with the
 * revision that event produced.
 *
 * A listener call is the unit of atomicity. Every change in one call shares its revision
 * and is swept against active reads together, so a transaction spanning several stores
 * invalidates once rather than once per store. Order within a call carries no meaning:
 * nothing here is applied, only re-read, so a put and a later delete of the same record
 * invalidate the same reads whichever way round they arrive.
 *
 * Deliver a whole committed event per call. A single-store host passes one change; a
 * store batching within itself can equally put the batch in one `value`, since only its
 * own views read that.
 *
 * Revisions are non-negative safe integers and strictly increase from one delivery to
 * the next. An empty delivery advances the revision without changing anything.
 */
export type StoreChangeListener<Payload = unknown> = (
  changes: readonly StoreChange<Payload>[],
  revision: Revision,
) => void;

/**
 * The host's change notifications, which a runtime subscribes to and nothing else reads.
 * Store views never see it; they read through their own store's handle. The feed owns
 * the revision: the runtime adopts its stamps rather than counting deliveries itself,
 * so revisions from runtimes over one feed are comparable.
 */
export type ChangeFeed = {
  /**
   * Must be attached before reads begin. Announces the feed's current revision with an
   * empty delivery before returning. The returned function detaches only this listener.
   */
  subscribe(listener: StoreChangeListener): () => void;
};

/**
 * Whatever a store's views read through. Opaque to the engine, which only passes it from
 * `GetStoreFn` to the store's own views; each store view narrows it with its `Handle`.
 */
export type StoreHandle = unknown;

/**
 * Supplies a store's handle. Called at most once per store per evaluation, when a read
 * first reaches the store. A promise holds that store's reads until it settles, which
 * lets a store open lazily; a rejection or a missing store fails them with a `StoreError`.
 *
 * A store whose views' `resolve` returns the result itself must supply its handle at
 * once: their readers are typed to receive the result without waiting.
 */
export type GetStoreFn = (name: StoreName) => PromiseOrValue<StoreHandle>;

/** The handle of the store view's own store, and the lifetime of one read or batch. */
export type StoreViewContext<Handle = StoreHandle> = {
  readonly store: Handle;
  readonly signal: AbortSignal;
  /**
   * The revision the read is asked at. A store keeping history reads as of it; one that
   * cannot reads current state instead. A store that answers from older state, such as a
   * cache serving while it catches up, reports that state's revision: the answer is stale,
   * and so is every view that reads it.
   */
  readonly revision: Revision;
  /**
   * Wraps an answer with what the store knows beyond its data. Returning the data itself
   * is the same as returning `annotate({ data })`. Readers receive `data` either way.
   */
  readonly annotate: AnnotateFn;
};

/** Wraps a store view's data with what the store knows beyond it. */
export type AnnotateFn = <Result, Footprint = never>(
  args: AnnotationArgs<Result, Footprint>,
) => AnnotatedResult<Result, Footprint>;

/** An answer of a store view, with what the store knows beyond its data. */
export type AnnotationArgs<Result, Footprint = unknown> = {
  /** What readers receive. */
  readonly data: Result;
  /**
   * The revision whose state the answer is: it reflects every change up to it, and none
   * after. A store keeping history reads as of the revision it is asked at and reports
   * that one; a store reading its current state reports that state's revision when it
   * knows it, and nothing otherwise.
   *
   * Below the revision asked, the answer is stale: it misses changes the reader asked to
   * see. The instance that read it, and every instance reading that one inline, settles
   * stale, and whoever keeps it decides when to read again.
   *
   * Changes after it are matched against the read. Without it, the read gets the revision
   * it was asked at, and its answer may reflect later changes too. A read that reports
   * the revision it was asked at is taken to come from history: see `StoreRead.exact`.
   */
  readonly revision?: Revision;
  /**
   * What the answer turned out to cover, for `matches` to test changes against beyond
   * the arguments: the keys a range returned, the far edge of a page, the gap an empty
   * read scanned. Recorded on the `StoreRead`. Describes the answer as returned, never
   * the request; a footprint narrower than the answer misses changes silently.
   *
   * Plain data, immutable once returned: it is kept as long as the read is, and may
   * cross a boundary with it.
   */
  readonly footprint?: Footprint;
};

declare const annotatedResult: unique symbol;
declare const annotatedFootprint: unique symbol;

/** What `StoreViewContext.annotate` returns. Opaque: return it, never inspect it. */
export type AnnotatedResult<Result = unknown, Footprint = unknown> = {
  readonly [annotatedResult]: Result;
  readonly [annotatedFootprint]: Footprint;
};

/** The data of a store view's answer, wrapped by `StoreViewContext.annotate` or not. */
export type StoreData<Answer> = Answer extends AnnotatedResult<infer Result>
  ? Result
  : Answer;

/** The footprint a store view's answer reports; `never` when it reports none. */
export type StoreFootprint<Answer> = Answer extends AnnotatedResult<
  unknown,
  infer Footprint
>
  ? Footprint
  : never;

/** How readers receive a store view's answer: its data, at once or later. */
export type StoreReadAnswer<Answer> = Answer extends Promise<infer Later>
  ? Promise<StoreData<Later>>
  : StoreData<Answer>;

/**
 * A store view is a deterministic leaf over its store's handle. Arguments use the ordinary
 * view codec; they select data, never carry a handle or a function.
 *
 * It reads one of two ways. `resolve` answers each read on its own, the moment a view
 * issues it. `resolveBatch` answers every read of this store view in one round together.
 * Either may answer synchronously, which completes its reads within the round; a promise
 * holds them until it settles.
 */
export type StoreViewOptions<
  Args,
  Result,
  Handle = StoreHandle,
  Footprint = unknown,
  Answer extends PromiseOrValue<
    Result | AnnotatedResult<Result, Footprint>
  > = PromiseOrValue<Result | AnnotatedResult<Result, Footprint>>,
> = {
  readonly store: StoreName;

  /** See `View.schema`. */
  readonly schema?: ViewSchema<Args, Result>;

  /** See `View.name`. */
  readonly name?: string;

  /** See `View.id`. */
  readonly id?: string;

  readonly access?: Partial<AccessConfig>;
  /**
   * Pure predicate over captured arguments, the footprint the answer recorded if any,
   * and a change to this store. Must include insertion after a missing read, and
   * conservatively match resets or other changes whose affected keys are unknown.
   * Operation labels are host-defined.
   */
  readonly matches: (
    args: Args,
    change: StoreChange,
    footprint: Footprint | undefined,
  ) => boolean;
} & (
  | {
      /**
       * Answers one read. A throw or a rejection fails that read. What it returns is how
       * its readers receive it, as for a view's `resolve`.
       */
      readonly resolve: (
        args: Args,
        context: StoreViewContext<Handle>,
      ) => Answer;
      readonly resolveBatch?: never;
    }
  | {
      /**
       * Answers distinct arguments, one slot each, in the order given. An `Error` in a
       * slot fails that read alone; a throw or a rejection fails every read in the batch.
       * Each slot may be wrapped by `context.annotate` on its own.
       */
      readonly resolveBatch: (
        args: readonly Args[],
        context: StoreViewContext<Handle>,
      ) => PromiseOrValue<
        readonly (Result | AnnotatedResult<Result, Footprint> | Error)[]
      >;
      readonly resolve?: never;
    }
);

/**
 * Declare a store-scoped leaf. Every evaluation records a dependency, including null or
 * undefined results. Several definitions may read the same store; their identities
 * remain distinct.
 *
 * `Handle` describes what the application's `GetStoreFn` must return for this store. Its
 * capabilities are the application's responsibility, not runtime-checked.
 */
export type StoreViewFn = {
  /** Answers as `resolve` does; type arguments name the answer, as for `ViewFn`. */
  <
    Args,
    Answer extends PromiseOrValue<unknown>,
    Handle = StoreHandle,
    const DeclaredAccess extends Partial<AccessConfig> = Record<string, never>,
    Result = StoreData<Settled<Answer>>,
    Footprint = StoreFootprint<Settled<Answer>>,
  >(
    options: StoreViewOptions<
      Args,
      Result,
      Handle,
      Footprint,
      Answer & PromiseOrValue<Result | AnnotatedResult<Result, Footprint>>
    > & {
      readonly resolve: unknown;
      readonly access?: DeclaredAccess;
    },
  ): StoreView<Args, Result, DeclaredAccess, StoreReadAnswer<Answer>>;

  /** A batch is answered once its round forms, so a read of it may wait. */
  <
    Args,
    Result,
    Handle = StoreHandle,
    const DeclaredAccess extends Partial<AccessConfig> = Record<string, never>,
    Footprint = unknown,
  >(
    options: StoreViewOptions<Args, Result, Handle, Footprint> & {
      readonly resolveBatch: unknown;
      readonly access?: DeclaredAccess;
    },
  ): StoreView<Args, Result, DeclaredAccess>;
};

/**
 * One read a store view performed, as plain data. Nothing here is state, and nothing
 * outside `view` and `revision` is interpreted by the engine.
 *
 * A change affects a read when the store view's `matches` says so: a pure
 * function, so the engine knows that a read has a test, never what the test means.
 * Filters, bounds, and index mechanics live behind it. It is the one thing neither
 * operand can answer alone: anything unary in the read belongs here, and anything unary
 * in a change belongs on `StoreChange`.
 */
export type StoreRead<Args = unknown, Footprint = unknown> = {
  /** The store view read. */
  readonly view: StoreView<Args, unknown, AccessConfig>;

  /** The arguments the store view was read with, as given. */
  readonly args: Args;

  /**
   * The answer reflects every change up to this revision: the one the store reported, or
   * the revision it was asked at. Only later changes are matched. Below the revision it
   * was asked at, the answer is stale: see `AnnotationArgs.revision`.
   */
  readonly revision: Revision;

  /**
   * Whether the store reported the revision it was asked at: the answer is the state at
   * exactly that revision, as a store keeping history reads it, and the store can answer
   * as of an earlier revision just as well. A store reading its current state that
   * happens to be at the revision asked looks the same, and costs a rerun at most.
   */
  readonly exact: boolean;

  /** What the answer covered, as the store view reported it. See `AnnotationArgs.footprint`. */
  readonly footprint?: Footprint;
};
