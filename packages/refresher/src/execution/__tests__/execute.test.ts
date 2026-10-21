import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as fc from "fast-check";
import type { Ref, PromiseOrValue } from "../../api.core";
import type { Environment } from "../../api.env";
import type { ExecutionState, ViewInstance } from "../../api.execution";
import {
  createMessageChannelEnvironment,
  nodeEnvironment,
} from "../../env/environment";
import { execute } from "../execute";
import type { World } from "./world";
import {
  buildWorld,
  codec,
  keyOf,
  modelOf,
  parseKey,
  refKey,
  refsIn,
  settledOf,
  worldArb,
} from "./world";

const REVISION = 7;

const ENVIRONMENTS: readonly (readonly [string, Environment])[] = [
  ["node", nodeEnvironment],
  ["MessageChannel", createMessageChannelEnvironment()],
];

/**
 * Executes a world's roots, then, wave by wave, every ref not seen before, in the order
 * found. A driver that waits between waves continues each in a later microtask.
 */
function runWorld(
  world: World,
  host: Environment,
): PromiseOrValue<ExecutionState> {
  const env: Environment = {
    scheduleReadRound: (callback) => host.scheduleReadRound(callback),
    scheduleUpdatePass: (callback) => host.scheduleUpdatePass(callback),
    report: (report) =>
      assert.equal(report.assert, "sometimes", report.message),
  };
  const dependencies = {
    codec,
    env,
    latestRevision: () => REVISION,
    store: world.getStore,
  };
  const seen = new Set(world.roots.map((ref) => refKey(world, ref)));
  const follow = (state: ExecutionState): PromiseOrValue<ExecutionState> => {
    for (;;) {
      const refs: Ref[] = [];
      for (const instance of state.waves[state.waves.length - 1]!.evaluated) {
        for (const ref of refsIn(settledOf(instance).data)) {
          const key = refKey(world, ref);
          if (!seen.has(key)) {
            seen.add(key);
            refs.push(ref);
          }
        }
      }
      if (refs.length === 0) return state;
      const prior = state;
      const continueIt = (): PromiseOrValue<ExecutionState> =>
        execute({ state: prior, refs });
      if (world.spec.waitsBetweenWaves)
        return Promise.resolve().then(continueIt).then(follow);
      const executed = continueIt();
      if (executed instanceof Promise) return executed.then(follow);
      assert.equal(
        executed.waves,
        prior.waves,
        "continuing returned another execution",
      );
      state = executed;
    }
  };
  const started = execute({ ...dependencies, refs: world.roots });
  return started instanceof Promise ? started.then(follow) : follow(started);
}

/** The waves the model expects, as the view keys of their refs. */
function expectedWaves(
  world: World,
  model: ReturnType<typeof modelOf>,
): string[][] {
  const waves: string[][] = [];
  let keys = world.spec.roots.map(([index, arg]) => keyOf(index, arg));
  const seen = new Set(keys);
  while (keys.length > 0) {
    waves.push(keys);
    const next: string[] = [];
    for (const key of keys) {
      const [index, arg] = parseKey(key);
      for (const ref of model.evaluate(index, arg).refs) {
        if (!seen.has(ref)) {
          seen.add(ref);
          next.push(ref);
        }
      }
    }
    keys = next;
  }
  return waves;
}

function instanceKey(world: World, instance: ViewInstance): string {
  return keyOf(world.indexOf(instance.view), Number(instance.args));
}

function checkInstance(
  world: World,
  model: ReturnType<typeof modelOf>,
  instance: ViewInstance,
): void {
  const [index, arg] = parseKey(instanceKey(world, instance));
  const outcome = model.evaluate(index, arg);
  assert.equal(instance.revision, REVISION);
  assert.equal(settledOf(instance).descriptor.validThrough, REVISION);
  if (outcome.failed) {
    assert.equal(settledOf(instance).data, null);
    assert.equal(settledOf(instance).errors.length, 1);
    assert.equal(settledOf(instance).errors[0]!.kind, "value");
    assert.deepEqual(settledOf(instance).errors[0]!.path, []);
  } else {
    assert.deepEqual(settledOf(instance).data, outcome.data);
    assert.deepEqual(settledOf(instance).errors, []);
  }
  const reads = settledOf(instance).descriptor.storeReads.map((read) => {
    assert.equal(read.revision, REVISION);
    return `${String(read.view.name).slice(1)}:${String(read.args)}`;
  });
  assert.equal(new Set(reads).size, reads.length, "store reads repeat");
  assert.deepEqual(new Set(reads), outcome.reads);
}

for (const [name, env] of ENVIRONMENTS) {
  describe(`execute over generated worlds, ${name} environment`, () => {
    it("settles every instance as the model evaluates it, once per instance", async () => {
      await fc.assert(
        fc.asyncProperty(worldArb, async (spec) => {
          const world = buildWorld(spec);
          const model = modelOf(world);
          const result = runWorld(world, env);
          const state = await result;
          assert.equal(state.startedAt, REVISION);
          assert.equal(state.settledAt, REVISION);

          const expected = expectedWaves(world, model);
          assert.equal(state.waves.length, expected.length);
          for (const [index, wave] of state.waves.entries()) {
            assert.equal(wave.settledAt, REVISION);
            assert.deepEqual(
              wave.refs.map((ref) => refKey(world, ref)),
              expected[index],
            );
            assert.equal(wave.evaluated.length, wave.refs.length);
            for (const [position, instance] of wave.evaluated.entries()) {
              assert.equal(
                instanceKey(world, instance),
                expected[index]![position],
              );
              assert.equal(state.instances.get(instance.id), instance);
            }
          }

          // Every instance the model evaluates, and every store read, once each.
          const ran = new Set<string>();
          const read = new Set<string>();
          for (const [id, instance] of state.instances) {
            assert.equal(instance.id, id);
            if (world.indexOf(instance.view) < 0) {
              const key = `${String(instance.view.name).slice(1)}:${String(
                instance.args,
              )}`;
              assert.ok(!read.has(key), `${key} resolved twice`);
              read.add(key);
              continue;
            }
            const key = instanceKey(world, instance);
            assert.ok(!ran.has(key), `${key} resolved twice`);
            ran.add(key);
            checkInstance(world, model, instance);
          }
          assert.deepEqual(ran, model.ran);
          assert.deepEqual(read, model.storeReads);

          const issued = world.calls.flatMap((call) =>
            call.args.map((arg) => `${call.store}:${arg}`),
          );
          assert.equal(
            new Set(issued).size,
            issued.length,
            "a store read was resolved twice",
          );
          assert.deepEqual(new Set(issued), model.storeReads);

          const waits = [...model.ran].some(
            (key) => world.waits[Number(key.split(":")[0])],
          );
          if (!waits && !spec.waitsBetweenWaves) {
            assert.ok(
              !(result instanceof Promise),
              "settled in the calling task, yet returned a promise",
            );
          }

          const again = buildWorld(spec);
          await runWorld(again, env);
          assert.deepEqual(
            again.calls,
            world.calls,
            "store calls differ between runs",
          );
        }),
        { timeout: 2000 },
      );
    });
  });
}
