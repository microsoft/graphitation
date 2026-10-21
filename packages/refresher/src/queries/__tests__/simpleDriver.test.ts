/* Property tests of the simple driver against reachability over a generated graph of views. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as fc from "fast-check";
import type { AnyRef, AnyView, PromiseOrValue, RefMeta } from "../../api.core";
import type { ViewInstanceDescriptor } from "../../api.invalidation";
import type {
  DriverContext,
  QueryPayload,
  QueryResult,
} from "../../api.queries";
import { createJsonCodec } from "../../codec/json";
import { defaultEnvironment } from "../../env/environment";
import { isRefresherError } from "../../errors";
import { execute } from "../../execution/execute";
import { createBind } from "../../views/bind";
import { view } from "../../views/definitions";
import { createRef } from "../../views/ref";
import { createSimpleDriver } from "../simpleDriver";

const NODES = 6;
const TAGS = ["a", "b", "c"];

type Edge = {
  readonly to: number;
  readonly tags: readonly string[] | undefined;
};

type Scenario = {
  readonly edges: readonly (readonly Edge[])[];
  /** The roots, possibly none, possibly repeated. */
  readonly roots: readonly number[];
  /** The tags to follow, or none given. */
  readonly follow: readonly string[] | undefined;
  readonly async: boolean;
  /** A restart after it starts, whose result is checked instead; none without one. */
  readonly restart: Restart | undefined;
};

type Restart = {
  /** The stale nodes, possibly repeated: each is reported once. */
  readonly stale: readonly number[];
  /** The other nodes subscribed, valid: those in `stale` aside. */
  readonly valid: readonly number[];
};

const tagList = fc.subarray(TAGS);
const rootList = fc.array(fc.nat(NODES - 1), { maxLength: 3 });

const scenarios: fc.Arbitrary<Scenario> = fc.record({
  edges: fc.array(
    fc.array(
      fc.record({
        to: fc.nat(NODES - 1),
        tags: fc.option(tagList, { nil: undefined }),
      }),
      {
        maxLength: 3,
      },
    ),
    { minLength: NODES, maxLength: NODES },
  ),
  roots: rootList,
  follow: fc.option(tagList, { nil: undefined }),
  async: fc.boolean(),
  restart: fc.option(
    fc.record({
      stale: rootList,
      valid: fc.subarray([...Array(NODES).keys()]),
    }),
    {
      nil: undefined,
    },
  ),
});

/** A driver context with no store, no view cache and no kept pins, at revision 0. */
function driverContext(signal = new AbortController().signal): DriverContext {
  const codec = createJsonCodec();
  const env = defaultEnvironment;
  return {
    revision: 0,
    env,
    codec,
    bind: createBind(codec),
    signal,
    execute: ({ state, refs, meta }) =>
      state !== undefined
        ? execute({ state, refs, meta })
        : execute({
            asOf: 0,
            latestRevision: () => 0,
            env,
            codec,
            signal,
            refs,
            meta,
          }),
  };
}

/** The driver's whole result: it never delivers incrementally. */
function single<Output>(
  result: PromiseOrValue<QueryResult<Output, never>>,
): PromiseOrValue<QueryPayload<Output>> {
  return result instanceof Promise ? result.then(whole) : whole(result);
}

function whole<Output>(
  result: QueryResult<Output, never>,
): QueryPayload<Output> {
  assert.ok(!("initialResult" in result), "delivered incrementally");
  return result;
}

/** What a runtime would keep of node `id`: its reads do not matter to the driver. */
function descriptorOf(node: AnyView, id: number): ViewInstanceDescriptor {
  const key = createJsonCodec().instanceKey(node, id);
  return { view: node, args: id, id: key, storeReads: [], validThrough: 0 };
}

/** The nodes reachable from `roots` over edges holding a followed tag, not entering `valid`. */
function reachable(
  scenario: Scenario,
  roots: readonly number[],
  valid: ReadonlySet<number>,
): Set<number> {
  const reached = new Set(roots);
  let grew = true;
  while (grew) {
    grew = false;
    for (const from of reached) {
      for (const edge of scenario.edges[from] ?? []) {
        const followed =
          edge.tags?.some((tag) => scenario.follow?.includes(tag)) ?? false;
        if (followed && !reached.has(edge.to) && !valid.has(edge.to)) {
          reached.add(edge.to);
          grew = true;
        }
      }
    }
  }
  return reached;
}

/** A view per scenario: node `id` returns its id and a ref per edge, counting its runs. */
function nodeView(scenario: Scenario, runs: number[]): AnyView {
  const node: AnyView = view({
    name: "node",
    resolve: (id: number, { ref }) => {
      runs[id] = (runs[id] ?? 0) + 1;
      const refTo = ref as unknown as (
        target: AnyView,
        args: number,
        meta?: RefMeta,
      ) => AnyRef;
      const children = (scenario.edges[id] ?? []).map((edge) =>
        refTo(
          node,
          edge.to,
          edge.tags === undefined ? undefined : { tags: edge.tags },
        ),
      );
      const data = { id, children };
      return scenario.async ? Promise.resolve(data) : data;
    },
  });
  return node;
}

void describe("simpleDriver", () => {
  void it("runs every instance the roots and tagged refs reach, each once and nothing else, and on restart no valid one", async () => {
    await fc.assert(
      fc.asyncProperty(scenarios, async (scenario) => {
        const runs: number[] = [];
        const node = nodeView(scenario, runs);
        const context = driverContext();
        const driver = createSimpleDriver(scenario.follow);
        const refs = (ids: readonly number[]) =>
          ids.map((id) => createRef(node, id));
        const settled = <T>(result: PromiseOrValue<T>) => {
          if (!scenario.async)
            assert.ok(!(result instanceof Promise), "settled in a later task");
          return result;
        };
        const start = { roots: refs(scenario.roots), context };
        let roots = scenario.roots;
        let valid = new Set<number>();
        let result = await settled(single(driver.start(start)));
        const { restart } = scenario;
        if (restart !== undefined) {
          roots = [...new Set(restart.stale)];
          valid = new Set(restart.valid.filter((id) => !roots.includes(id)));
          const views = new Map<string, ViewInstanceDescriptor>();
          for (const id of [...roots, ...valid]) {
            const kept = descriptorOf(node, id);
            views.set(kept.id, kept);
          }
          const stale = roots.map((id) => ({
            descriptor: views.get(context.codec.instanceKey(node, id))!,
            reason: { kind: "unverifiable" as const },
          }));
          runs.length = 0;
          result = await settled(
            single(
              driver.restart({
                descriptor: {
                  id: 0,
                  driver,
                  roots: start.roots,
                  views,
                  pins: new Map(),
                  footprint: undefined,
                },
                invalidated: { stale },
                context,
              }),
            ),
          );
        }

        const { output, waves } = result;
        const expected = reachable(scenario, roots, valid);
        const reached = new Set<number>();
        for (const instance of output.instances.values()) {
          assert.notEqual(instance.status, "running");
          assert.deepEqual(
            Reflect.get(Object(instance.data), "id"),
            instance.args,
          );
          assert.ok(waves.some((wave) => wave.evaluated.includes(instance)));
          reached.add(instance.args as number);
        }
        assert.deepEqual(reached, expected);
        assert.equal(output.instances.size, expected.size);
        for (let id = 0; id < NODES; id++) {
          assert.equal(runs[id] ?? 0, expected.has(id) ? 1 : 0);
        }
        assert.equal(waves.length === 0, roots.length === 0);
        assert.deepEqual(waves[0]?.refs.map((ref) => ref.args) ?? [], roots);
        assert.equal(output.roots.length, roots.length);
        roots.forEach((id, index) => {
          const root = output.roots[index]!;
          assert.equal(root.id, context.codec.instanceKey(node, id));
          assert.equal(output.instances.get(root.id), root);
        });
      }),
    );
  });

  void it("rejects when its signal aborts", async () => {
    const pending = view({
      name: "pending",
      resolve: () => new Promise<number>(() => undefined),
    });
    const controller = new AbortController();
    const aborted = Promise.resolve(
      single(
        createSimpleDriver().start({
          roots: [createRef(pending as unknown as AnyView, 0)],
          context: driverContext(controller.signal),
        }),
      ),
    );
    controller.abort();
    await assert.rejects(
      aborted,
      (error) => isRefresherError(error) && error.code === "ABORTED",
    );
  });
});
