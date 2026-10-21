import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as fc from "fast-check";
import type { AssertReport, Environment } from "../../api.env";
import { assertAlways, assertNever, assertSometimes } from "../assert";
import { isRefresherError } from "../../errors";

type Log = (AssertReport | "thrown")[];

function schedule(callback: () => void): void {
  queueMicrotask(callback);
}

/** An environment that logs reports, or one that reports nothing. */
function environmentOf(log: Log, reports: boolean): Environment {
  const schedules = {
    scheduleReadRound: schedule,
    scheduleUpdatePass: schedule,
  };
  return reports
    ? { ...schedules, report: (report) => void log.push(report) }
    : schedules;
}

/** Runs `check`, logging a throw after whatever it reported; returns what it threw. */
function run(log: Log, check: () => void): unknown {
  try {
    check();
    return undefined;
  } catch (error) {
    log.push("thrown");
    return error;
  }
}

function reportOf(
  kind: AssertReport["assert"],
  message: string,
  details: unknown,
): AssertReport {
  return details === undefined
    ? { assert: kind, message }
    : { assert: kind, message, details };
}

function checkFailure(error: unknown, message: string): void {
  assert.ok(isRefresherError(error));
  assert.equal(error.kind, "internal");
  assert.equal(error.message, message);
}

const details = fc.option(fc.anything(), { nil: undefined });

describe("asserts", () => {
  it("assertAlways reports a false condition, then throws; a true one does neither", () => {
    fc.assert(
      fc.property(
        fc.anything(),
        fc.string(),
        details,
        fc.boolean(),
        (cond, message, extra, reports) => {
          const log: Log = [];
          const error = run(log, () =>
            assertAlways(environmentOf(log, reports), cond, message, extra),
          );
          if (cond) {
            assert.deepEqual(log, []);
            return;
          }
          checkFailure(error, message);
          assert.deepEqual(
            log,
            reports
              ? [reportOf("always", message, extra), "thrown"]
              : ["thrown"],
          );
        },
      ),
    );
  });

  it("assertNever reports the value it was given, then throws", () => {
    fc.assert(
      fc.property(
        fc.anything(),
        fc.string(),
        fc.boolean(),
        (value, message, reports) => {
          const log: Log = [];
          const env = environmentOf(log, reports);
          const error = run(log, () =>
            assertNever(env, value as never, message),
          );
          checkFailure(error, message);
          assert.deepEqual(
            log,
            reports
              ? [reportOf("never", message, value), "thrown"]
              : ["thrown"],
          );
        },
      ),
    );
  });

  it("assertSometimes reports a true condition and never throws", () => {
    fc.assert(
      fc.property(
        fc.anything(),
        fc.string(),
        details,
        fc.boolean(),
        (cond, message, extra, reports) => {
          const log: Log = [];
          const error = run(log, () =>
            assertSometimes(environmentOf(log, reports), cond, message, extra),
          );
          assert.equal(error, undefined);
          assert.deepEqual(
            log,
            cond && reports ? [reportOf("sometimes", message, extra)] : [],
          );
        },
      ),
    );
  });

  it("names an assert without a message by its call site, the same on every call", () => {
    const log: Log = [];
    const env = environmentOf(log, true);
    const failAt = (): unknown => run(log, () => assertAlways(env, false));
    const holdAt = (): unknown => run(log, () => assertSometimes(env, true));
    const neverAt = (): unknown => run(log, () => assertNever(env, 0 as never));
    const errors = [failAt(), failAt(), holdAt(), holdAt(), neverAt()];
    const messages = log.flatMap((entry) =>
      entry === "thrown" ? [] : [entry.message],
    );
    assert.equal(messages.length, 5);
    for (const message of messages)
      assert.match(message, /assert\.test\.ts:\d+:\d+/);
    assert.equal(messages[0], messages[1]);
    assert.equal(messages[2], messages[3]);
    assert.equal(new Set(messages).size, 3);
    checkFailure(errors[0], messages[0] ?? "");
    checkFailure(errors[4], messages[4] ?? "");
    assert.equal(errors[2], undefined);
  });
});
