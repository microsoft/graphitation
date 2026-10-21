/**
 * Invalidation: matching changes against the store reads a result depends on. One function
 * serves both things kept across executions: a cached instance, checked when it is used
 * again, and what a subscription keeps, checked as each delivery arrives. See
 * docs/architecture/invalidation.md and docs/architecture/view-caching.md#validation.
 *
 * Shaped like `./api.execution`: one call takes everything as one object and returns its
 * result. It runs no view and reads no store; each read is tested by its store view's
 * `matches`, a pure function, so the same changes and descriptors always give the same
 * result.
 *
 * Driver-author vocabulary, separate from the consumer contract in `./api.core`.
 */
import type { AnyView, Revision, ViewInstanceId } from "./api.core";
import type { Environment } from "./api.env";
import type { StoreChange, StoreRead } from "./api.stores";

/**
 * Every change of one atomic event, at the revision it produced: what one
 * `StoreChangeListener` call carries.
 */
export type Delivery = {
  readonly revision: Revision;
  readonly changes: readonly StoreChange[];
};

/**
 * The changes a runtime keeps, for a recent window: every delivery after `tail`, up to
 * and including `head`. The runtime appends each delivery as it arrives, and trims by its
 * own retention policy.
 */
export type ChangeLog = {
  /** The window starts after this revision: changes at it or before are gone. */
  readonly tail: Revision;

  /** The latest revision the window covers. */
  readonly head: Revision;

  /** How many changes the window holds: what a retention policy weighs. */
  readonly size: number;

  /**
   * The deliveries after `revision`, up to `head`, in strictly increasing revision order;
   * `tail <= revision <= head`. A delivery that changed nothing may be left out. Read
   * synchronously, one scan at a time: an implementation may reuse its iterator, and the
   * window does not move during a scan.
   */
  since(revision: Revision): Iterable<Delivery>;

  /**
   * Adds a delivery after `head`, and `head` moves to its revision. One that changed
   * nothing only moves `head`.
   */
  append(delivery: Delivery): void;

  /** Drops every delivery at or before `revision`, `tail <= revision <= head`; `tail` moves to it. */
  trim(revision: Revision): void;
};

/** An empty change log whose window starts and ends at `revision`. */
export type CreateChangeLogFn = (args: CreateChangeLogArgs) => ChangeLog;

export type CreateChangeLogArgs = {
  readonly env: Environment;
  readonly revision: Revision;
};

/**
 * A settled view instance without its result: which one it is, and the store reads its
 * result depends on, known valid through `validThrough`, to match changes against. Each
 * settled `ViewInstance` holds one, which the view cache validates and a subscription
 * keeps in place of the instance.
 */
export type ViewInstanceDescriptor = {
  readonly view: AnyView;
  readonly args: unknown;
  readonly id: ViewInstanceId;

  /**
   * Every store read its result depends on, each recorded once: its own view's and those
   * of every view it read inline, recursively, memoized or not. A memoized view's are the
   * same objects its own instance holds, with that instance's revisions.
   */
  readonly storeReads: readonly StoreRead[];

  /**
   * The latest revision it is known valid at: its instance's `revision` when it settles,
   * or, settled stale, the oldest revision a store answered one of its stale reads at.
   * Whoever holds it advances it in place as changes since are matched against its reads
   * and none reaches them, so every holder shares what was checked. It only increases, so
   * whatever was decided against an earlier value still holds.
   */
  validThrough: Revision;
};

/**
 * Matches descriptors against every change through `changes.head`. Each one it is given ends
 * in one of three ways:
 *
 * - **Valid.** No change after its `validThrough` hits its `storeReads`: it is valid through
 *   `changes.head`, and the result leaves it out.
 * - **Stale.** One does, and the result says which.
 * - **Unverifiable.** The log no longer holds every change since its `validThrough`.
 *
 * A read is matched only against changes after its own `revision` and after `validThrough`:
 * whatever was decided before still holds. Nothing given is changed: dropping a stale
 * descriptor, or advancing `validThrough`, is the caller's.
 */
export type InvalidateFn = <T extends ViewInstanceDescriptor>(
  args: InvalidateArgs<T>,
) => InvalidateResult<T>;

export type InvalidateArgs<T extends ViewInstanceDescriptor> = {
  readonly env: Environment;

  /** The changes to match. */
  readonly changes: ChangeLog;

  /** What to validate: cached instances about to be used, or what subscriptions keep. */
  readonly descriptors: readonly T[];
};

export type InvalidateResult<T extends ViewInstanceDescriptor> = {
  /** Each of the given descriptors no longer valid through `changes.head`, once, with why. */
  readonly stale: readonly Invalidated<T>[];
};

/** A descriptor no longer valid, and why. */
export type Invalidated<T extends ViewInstanceDescriptor> = {
  readonly descriptor: T;
  readonly reason: StaleReason;
};

/**
 * Why a descriptor is no longer valid: a change hit one of its reads, or nothing can
 * confirm them. Invalidation stops at the first hit: explaining every hit is separate.
 */
export type StaleReason = Hit | Unverifiable;

/** A change hit one of the reads: of the view itself, or of a view it read inline. */
export type Hit = {
  readonly kind: "hit";

  /** The read the change hit. */
  readonly read: StoreRead;

  /** The witness: the first change that hit it. */
  readonly change: StoreChange;

  /** The revision of the delivery the change came in. */
  readonly revision: Revision;
};

/** Nothing can confirm the reads: the log no longer holds every change since `validThrough`. */
export type Unverifiable = {
  readonly kind: "unverifiable";
};
