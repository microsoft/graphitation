import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as fc from "fast-check";
import type { Environment } from "../../api.env";
import {
  createMainThreadEnvironment,
  createMessageChannelEnvironment,
  defaultEnvironment,
  nodeEnvironment,
} from "../environment";

type Schedule = (env: Environment, callback: () => void) => void;

const ROUND: Schedule = (env, callback) => env.scheduleReadRound(callback);
const PASS: Schedule = (env, callback) => env.scheduleUpdatePass(callback);

/** Each environment, and the schedules that wait for the microtask queue to drain. */
const ENVIRONMENTS: readonly (readonly [
  string,
  () => Environment,
  readonly Schedule[],
])[] = [
  ["node", () => nodeEnvironment, [ROUND, PASS]],
  ["MessageChannel", createMessageChannelEnvironment, [ROUND, PASS]],
  ["default", () => defaultEnvironment, [ROUND, PASS]],
  ["main thread", createMainThreadEnvironment, [ROUND]],
];

/** Queues a chain of `length` microtasks, each queued by the one before. */
function chain(length: number, log: string[], name: string): void {
  let step = Promise.resolve();
  for (let index = 0; index < length; index += 1) {
    step = step.then(() => void log.push(name));
  }
}

/** Settles in a later task. */
function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

for (const [name, create, draining] of ENVIRONMENTS) {
  describe(`${name} environment`, () => {
    for (const schedule of draining) {
      const which = schedule === ROUND ? "a read round" : "an update pass";

      it(`schedules ${which} after the microtask queue drains, in the order asked`, async () => {
        await fc.assert(
          fc.asyncProperty(
            fc.array(fc.nat({ max: 20 }), { minLength: 1, maxLength: 5 }),
            async (lengths) => {
              const env = create();
              const log: string[] = [];
              const called = lengths.map(
                (length, index) =>
                  new Promise<void>((resolve) => {
                    chain(length, log, "microtask");
                    schedule(env, () => {
                      log.push(`callback ${index}`);
                      resolve();
                    });
                  }),
              );
              await Promise.all(called);
              const total = lengths.reduce((sum, length) => sum + length, 0);
              assert.deepEqual(log, [
                ...Array.from({ length: total }, () => "microtask"),
                ...lengths.map((_, index) => `callback ${index}`),
              ]);
            },
          ),
        );
      });

      it(`schedules ${which} after microtasks a callback queues`, async () => {
        const env = create();
        const log: string[] = [];
        await new Promise<void>((resolve) => {
          schedule(env, () => {
            chain(3, log, "microtask");
            schedule(env, () => {
              log.push("callback");
              resolve();
            });
          });
        });
        assert.deepEqual(log, [
          "microtask",
          "microtask",
          "microtask",
          "callback",
        ]);
      });
    }

    it("schedules an update pass later, never during the call, calling each back once", async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 10 }), async (count) => {
          const env = create();
          const calls = Array.from({ length: count }, () => 0);
          let calling = false;
          for (let index = 0; index < count; index += 1) {
            calling = true;
            env.scheduleUpdatePass(() => {
              assert.ok(!calling, "called back during the call");
              calls[index]! += 1;
            });
            calling = false;
          }
          await nextTask();
          await nextTask();
          assert.deepEqual(
            calls,
            Array.from({ length: count }, () => 1),
          );
        }),
      );
    });
  });
}

describe("main thread environment", () => {
  it("schedules an update pass in the task that asked, before any later task", async () => {
    const env = createMainThreadEnvironment();
    const log: string[] = [];
    const later = nextTask().then(() => void log.push("task"));
    const rounded = new Promise<void>((resolve) =>
      env.scheduleReadRound(() => {
        log.push("round");
        resolve();
      }),
    );
    env.scheduleUpdatePass(() => void log.push("pass"));
    await Promise.all([later, rounded]);
    assert.equal(log[0], "pass");
  });
});
