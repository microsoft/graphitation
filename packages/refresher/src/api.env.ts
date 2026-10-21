/**
 * The host environment: how the host schedules the work Refresher defers, and where
 * Refresher's own asserts report. A driver supplies it with each execution, so a test,
 * a simulation, a worker or a UI framework decides both. See
 * docs/architecture/testing.md.
 *
 * Driver-author vocabulary, separate from the consumer contract in `./api.core`. Names
 * no other contract file.
 */

/**
 * How the host schedules work Refresher defers. The driver supplies it, so a test, a
 * worker or a UI framework decides when deferred work runs.
 */
export type Environment = {
  /**
   * Calls `callback` once the microtask queue has drained: every promise callback queued
   * so far, and every one those queue, has run. An execution forms a round here, once every
   * running instance has run as far as it can. Calling back earlier splits rounds; later delays
   * them.
   */
  scheduleReadRound(callback: () => void): void;

  /**
   * Calls `callback` later, never during the call, to start a runtime's pending pass: the
   * queries run and the changes delivered until then run in it, at the latest revision.
   * Calling back later gathers more into one pass; sooner shows a change sooner. A host
   * rendering in the task that wrote, such as a UI thread, calls back in a microtask.
   */
  scheduleUpdatePass(callback: () => void): void;

  /**
   * Receives what Refresher's own asserts report: an `always` or `never` that failed,
   * before it throws, and a `sometimes` that held. A simulation harness supplies it to
   * observe them; without it they go unreported. It must not throw.
   */
  report?(report: AssertReport): void;
};

/** A new environment, with schedules of its own. */
export type CreateEnvironmentFn = () => Environment;

/** One report of an assert; see `docs/architecture/testing.md`. */
export type AssertReport = {
  readonly assert: "always" | "never" | "sometimes";

  /** The assert's identity across runs: a campaign aggregates reports by it. */
  readonly message: string;

  /** What the assert saw, to explain the report. */
  readonly details?: unknown;
};
