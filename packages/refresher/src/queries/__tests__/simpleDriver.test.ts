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
  return {
    view: node,
    args: id,
    id: key,
    storeReads: new Map(),
    matchedThrough: 0,
  };
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
        if (
          isFollowed(scenario, edge) &&
          !reached.has(edge.to) &&
          !valid.has(edge.to)
        ) {
          reached.add(edge.to);
          grew = true;
        }
      }
    }
  }
  return reached;
}

/** How many times each id occurs: a list compared as a multiset. */
function counts(ids: readonly string[]): Map<string, number> {
  const counted = new Map<string, number>();
  for (const id of ids) counted.set(id, (counted.get(id) ?? 0) + 1);
  return counted;
}
function isFollowed(scenario: Scenario, edge: Edge): boolean {
  return edge.tags?.some((tag) => scenario.follow?.includes(tag)) ?? false;
}

/** A view over `graph` as it is when it runs: node `id` returns its id and a ref per edge, counting its runs. */
function nodeView(
  graph: () => readonly (readonly Edge[])[],
  async: boolean,
  runs: number[],
): AnyView {
  const node: AnyView = view({
    name: "node",
    resolve: (id: number, { ref }) => {
      runs[id] = (runs[id] ?? 0) + 1;
      const refTo = ref as unknown as (
        target: AnyView,
        args: number,
        meta?: RefMeta,
      ) => AnyRef;
      const children = (graph()[id] ?? []).map((edge) =>
        refTo(
          node,
          edge.to,
          edge.tags === undefined ? undefined : { tags: edge.tags },
        ),
      );
      const data = { id, children };
      return async ? Promise.resolve(data) : data;
    },
  });
  return node;
}

/** What `id` leads to in `graph` over edges holding a tag `follow` names. */
function leadsTo(
  graph: readonly (readonly Edge[])[],
  follow: readonly string[] | undefined,
  id: number,
): number[] {
  return (graph[id] ?? [])
    .filter((edge) => edge.tags?.some((tag) => follow?.includes(tag)) ?? false)
    .map((edge) => edge.to);
}

/** The nodes not `valid` that `starts` are or lead to through `valid` ones alone. */
function front(
  graph: readonly (readonly Edge[])[],
  follow: readonly string[] | undefined,
  starts: Iterable<number>,
  valid: ReadonlySet<number>,
): Set<number> {
  const found = new Set<number>();
  const walked = new Set<number>();
  const stack = [...starts];
  for (let id = stack.pop(); id !== undefined; id = stack.pop()) {
    if (!valid.has(id)) found.add(id);
    else if (!walked.has(id)) {
      walked.add(id);
      stack.push(...leadsTo(graph, follow, id));
    }
  }
  return found;
}

void describe("simpleDriver", () => {
  void it("runs every instance the roots and tagged refs reach, each once and nothing else, and on a restart without kept edges, every stale one first and no valid one, reporting each one's tagged refs as traversed", async () => {
    await fc.assert(
      fc.asyncProperty(scenarios, async (scenario) => {
        const runs: number[] = [];
        const node = nodeView(() => scenario.edges, scenario.async, runs);
        const context = driverContext();
        const driver = createSimpleDriver(scenario.follow);
        const refs = (ids: readonly number[]) =>
          ids.map((id) =>
            createRef(node, id, undefined, context.codec.instanceKey(node, id)),
          );
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
                edges: undefined,
                context,
              }),
            ),
          );
        }

        const { output, waves, traversed } = result;
        const expected = reachable(scenario, roots, valid);
        assert.ok(traversed !== undefined);
        for (const id of traversed.keys()) assert.ok(output.instances.has(id));
        for (const instance of output.instances.values()) {
          const leads = (scenario.edges[instance.args as number] ?? [])
            .filter((edge) => isFollowed(scenario, edge))
            .map((edge) => context.codec.instanceKey(node, edge.to));
          assert.deepEqual(
            counts(traversed.get(instance.id) ?? []),
            counts(leads),
          );
        }
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

  void it("on a restart with the kept edges, walks from the roots through valid instances, running each instance not valid they still reach once, in the first wave its roots reach through valid ones alone, and in each later wave those the last one leads to", async () => {
    const changes = fc.record({
      stale: fc.subarray([...Array(NODES).keys()], { minLength: 1 }),
      edges: scenarios.map((scenario) => scenario.edges),
    });
    await fc.assert(
      fc.asyncProperty(scenarios, changes, async (scenario, change) => {
        const runs: number[] = [];
        let graph = scenario.edges;
        const node = nodeView(() => graph, scenario.async, runs);
        const context = driverContext();
        const key = (id: number) => context.codec.instanceKey(node, id);
        const driver = createSimpleDriver(scenario.follow);
        const roots = scenario.roots.map((id) =>
          createRef(node, id, undefined, key(id)),
        );
        const started = await single(driver.start({ roots, context }));
        const views = new Map<string, ViewInstanceDescriptor>();
        for (const instance of started.output.instances.values()) {
          const kept = descriptorOf(node, instance.args as number);
          views.set(kept.id, kept);
        }
        const stale = change.stale.filter((id) => views.has(key(id)));
        fc.pre(stale.length > 0);
        const valid = new Set<number>();
        for (const kept of views.values())
          if (!stale.includes(kept.args as number))
            valid.add(kept.args as number);
        // A stale node's data changed; a valid one's is as the start left it.
        graph = graph.map((edges, id) =>
          stale.includes(id) ? change.edges[id]! : edges,
        );
        runs.length = 0;
        const result = await single(
          driver.restart({
            descriptor: {
              id: 0,
              driver,
              roots,
              views,
              pins: new Map(),
              footprint: undefined,
            },
            invalidated: {
              stale: stale.map((id) => ({
                descriptor: views.get(key(id))!,
                reason: { kind: "unverifiable" as const },
              })),
            },
            edges: new Map(started.traversed),
            context,
          }),
        );

        const { output, waves } = result;
        const expected = new Set<number>();
        for (const id of reachable(
          { ...scenario, edges: graph },
          scenario.roots,
          new Set(),
        ))
          if (!valid.has(id)) expected.add(id);
        for (let id = 0; id < NODES; id++) {
          assert.equal(runs[id] ?? 0, expected.has(id) ? 1 : 0);
        }
        assert.deepEqual(
          new Set([...output.instances.values()].map((i) => i.args)),
          expected,
        );
        assert.equal(waves.length === 0, expected.size === 0);
        const ran = new Set<number>();
        let leads: Iterable<number> = scenario.roots;
        for (const wave of waves) {
          const next = front(graph, scenario.follow, leads, valid);
          for (const id of ran) next.delete(id);
          assert.deepEqual(
            new Set(wave.refs.map((ref) => ref.args as number)),
            next,
          );
          const evaluated = wave.evaluated.map(
            (instance) => instance.args as number,
          );
          for (const id of evaluated) ran.add(id);
          leads = evaluated.flatMap((id) =>
            leadsTo(graph, scenario.follow, id),
          );
        }
        assert.deepEqual(
          output.roots.map((root) => root.args),
          waves[0]?.evaluated.map((instance) => instance.args) ?? [],
        );
      }),
    );
  });

  void it("rejects when its signal aborts", async () => {
    const pending = view({
      name: "pending",
      resolve: () => new Promise<number>(() => undefined),
    });
    const controller = new AbortController();
    const context = driverContext(controller.signal);
    const root = createRef(
      pending as unknown as AnyView,
      0,
      undefined,
      context.codec.instanceKey(pending, 0),
    );
    const aborted = Promise.resolve(
      single(
        createSimpleDriver().start({
          roots: [root],
          context,
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
