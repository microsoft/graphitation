/**
 * Refresher's own asserts, with the semantics `docs/architecture/testing.md` gives them:
 * a failed `always` or `never` is reported to the environment, then throws an
 * `InternalError`; a `sometimes` that holds is reported.
 *
 * They follow TigerStyle: assert arguments, preconditions, postconditions and invariants,
 * about two per function; split compound conditions; write an implication as
 * `if (a) assertAlways(env, b)`; pair a property where it is written and where it is read.
 *
 * Write each as a statement. Its identity across runs is its message, or its call site
 * when it has none; the site is only computed for a report. A build may fill the site in
 * as a literal message and rewrite `assertAlways(env, cond)` to
 * `cond || assertAlways(env, false, ...)`, and `assertSometimes(env, cond, ...)` to
 * `cond && assertSometimes(env, true, ...)` or to nothing, so arguments other than the
 * condition must be free of side effects and cheap: a hot path passes no details.
 */
import type { AssertReport, Environment } from "../api.env";
import { internalError } from "../errors";

/** `cond` holds whenever this is evaluated. */
export function assertAlways(
  env: Environment,
  cond: unknown,
  message?: string,
  details?: unknown,
): asserts cond {
  if (cond) return;
  const identity = message ?? siteOf(assertAlways);
  report(env, "always", identity, details);
  throw internalError({ code: "ASSERTION", message: identity });
}

/** Control never reaches here; `value` is the case that should not exist. */
export function assertNever(
  env: Environment,
  value: never,
  message?: string,
): never {
  const identity = message ?? siteOf(assertNever);
  report(env, "never", identity, value);
  throw internalError({ code: "ASSERTION", message: identity });
}

/** The state `cond` describes is reached at all. Reports, never throws. */
export function assertSometimes(
  env: Environment,
  cond: unknown,
  message?: string,
  details?: unknown,
): void {
  if (!cond || env.report === undefined) return;
  report(env, "sometimes", message ?? siteOf(assertSometimes), details);
}

function report(
  env: Environment,
  assert: AssertReport["assert"],
  message: string,
  details: unknown,
): void {
  if (env.report === undefined) return;
  env.report(
    details === undefined ? { assert, message } : { assert, message, details },
  );
}

/** Where `assert` was called from, where the engine records stack frames. */
function siteOf(assert: (...args: never[]) => unknown): string {
  const trace: { stack?: string } = {};
  Error.captureStackTrace(trace, assert);
  const frame = trace.stack?.split("\n", 2)[1]?.trim();
  return frame === undefined ? "unknown site" : frame.replace(/^at /, "");
}
