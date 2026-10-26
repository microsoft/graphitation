/**
 * Garbage benchmark: how much a query run allocates, and where, when nothing changed.
 *
 * Every derived view is memoized, the view cache keeps every instance and the change log
 * keeps every change, so neither is measured. The stores never change: each run after the
 * first finds every instance in the view cache, and whatever it allocates is the cost of
 * running a query at all. Each scenario is warmed up, then measured twice:
 *
 * - exactly, as the heap grows over a batch of runs while no collection happens: run it
 *   with a young generation large enough to hold the batch, as `yarn bench:garbage` does;
 * - by allocating function, with V8's sampling heap profiler keeping the samples of
 *   objects already collected, mapped back to the TypeScript sources.
 *
 * Usage: yarn bench:garbage [--runs N] [--top N] [--scenario NAME] [--messages N] [--users N]
 */
import { Session } from "node:inspector/promises";
import { findSourceMap } from "node:module";
import { PerformanceObserver } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { getHeapStatistics } from "node:v8";
import type { QueryDriver } from "../../src/api.queries";
import type { RunResult, Runtime } from "../../src/api.runtime";
import type { StoreChange, StoreViewContext } from "../../src/api.stores";
import {
  createRuntime,
  defaultEnvironment,
  storeView,
  view,
} from "../../src/index";
import type { Ref } from "../../src/index";
import { createSimpleDriver } from "../../src/queries/simpleDriver";
import type { SimpleDriverOutput } from "../../src/queries/simpleDriver";

// Options

type Options = {
  readonly runs: number;
  readonly top: number;
  readonly scenario: string | undefined;
  readonly messages: number;
  readonly users: number;
};

function parseOptions(argv: readonly string[]): Options {
  const read = (name: string): string | undefined => {
    const index = argv.indexOf(`--${name}`);
    return index === -1 ? undefined : argv[index + 1];
  };
  const number = (name: string, fallback: number): number => {
    const text = read(name);
    if (text === undefined) return fallback;
    const value = Number(text);
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`--${name} takes a positive integer`);
    }
    return value;
  };
  return {
    runs: number("runs", 2000),
    top: number("top", 25),
    scenario: read("scenario"),
    messages: number("messages", 100),
    users: number("users", 10),
  };
}

// Workload: a chat room, its messages, and their authors

type User = { readonly id: number; readonly name: string };
type Message = {
  readonly id: number;
  readonly author: number;
  readonly text: string;
};
type Chat = {
  readonly id: number;
  readonly title: string;
  readonly messages: readonly number[];
};

type Records = {
  readonly users: ReadonlyMap<number, User>;
  readonly messages: ReadonlyMap<number, Message>;
  readonly chats: ReadonlyMap<number, Chat>;
};

function seed(messageCount: number, userCount: number): Records {
  const users = new Map<number, User>();
  for (let id = 0; id < userCount; id++)
    users.set(id, { id, name: `user ${id}` });
  const messages = new Map<number, Message>();
  const ids: number[] = [];
  for (let id = 0; id < messageCount; id++) {
    messages.set(id, { id, author: id % userCount, text: `message ${id}` });
    ids.push(id);
  }
  const chats = new Map<number, Chat>([
    [0, { id: 0, title: "room", messages: ids }],
  ]);
  return { users, messages, chats };
}

const byId = (id: number, change: StoreChange) => change.value === id;

const userRecord = storeView({
  store: "users",
  name: "userRecord",
  matches: byId,
  resolve: (
    id: number,
    { store }: StoreViewContext<ReadonlyMap<number, User>>,
  ) => store.get(id) ?? null,
});

const messageRecord = storeView({
  store: "messages",
  name: "messageRecord",
  matches: byId,
  resolve: (
    id: number,
    { store }: StoreViewContext<ReadonlyMap<number, Message>>,
  ) => store.get(id) ?? null,
});

const chatRecord = storeView({
  store: "chats",
  name: "chatRecord",
  matches: byId,
  resolve: (
    id: number,
    { store }: StoreViewContext<ReadonlyMap<number, Chat>>,
  ) => store.get(id) ?? null,
});

const TAGS = ["follow"];
const FOLLOW = { tags: TAGS };

/** Read inline by each message: a memoized view no ref names. */
const authorName = view({
  name: "authorName",
  memo: true,
  access: { readable: true },
  resolve: (id: number, { read }): string => read(userRecord, id)?.name ?? "",
});

type UserData = { readonly name: string };

const user = view({
  name: "user",
  memo: true,
  resolve: (id: number, { read }): UserData | null => {
    const record = read(userRecord, id);
    return record === null ? null : { name: record.name };
  },
});

type MessageData = {
  readonly text: string;
  readonly authorName: string;
  readonly author: Ref<UserData | null>;
};

const message = view({
  name: "message",
  memo: true,
  resolve: (id: number, { read, ref }): MessageData | null => {
    const record = read(messageRecord, id);
    if (record === null) return null;
    return {
      text: record.text,
      authorName: read(authorName, record.author),
      author: ref(user, record.author, FOLLOW),
    };
  },
});

type RoomData = {
  readonly title: string;
  readonly messages: readonly Ref<MessageData | null>[];
};

const room = view({
  name: "room",
  memo: true,
  access: { queryable: true },
  resolve: (id: number, { read, ref }): RoomData | null => {
    const record = read(chatRecord, id);
    if (record === null) return null;
    return {
      title: record.title,
      messages: record.messages.map((each) => ref(message, each, FOLLOW)),
    };
  },
});

// Scenarios

type Driver = QueryDriver<SimpleDriverOutput, never, never>;
type Result = RunResult<SimpleDriverOutput, SimpleDriverOutput, never>;

type Setup = {
  readonly runtime: Runtime;
  readonly driver: Driver;
  /** Instances one run reaches. */
  readonly instances: number;
  /** Bytes the runtime holds once warm, its view cache and change log included: its stores not. */
  readonly warmHeap: number;
};

type Scenario = {
  readonly name: string;
  readonly description: string;
  /** One run; returns a promise only when it does not settle synchronously. */
  readonly run: (setup: Setup) => void | Promise<void>;
};

function settled(result: unknown): Result {
  if (result instanceof Promise)
    throw new Error("The query was expected to settle at once");
  return result as Result;
}

const SCENARIOS: readonly Scenario[] = [
  {
    name: "immediate",
    description: "runtime.immediateQuery, result dropped",
    run: ({ runtime, driver }) => {
      settled(runtime.immediateQuery(room, 0, driver));
    },
  },
  {
    name: "subscribe",
    description: "runtime.immediateQuery, subscribed, then unsubscribed",
    run: ({ runtime, driver }) => {
      settled(runtime.immediateQuery(room, 0, driver))
        .subscribe({ next: noop })
        .unsubscribe();
    },
  },
  {
    name: "pass",
    description: "runtime.query, awaited: runs in an update pass",
    run: async ({ runtime, driver }) => {
      await runtime.query(room, 0, driver);
    },
  },
];

function noop(): void {}

function setUp(options: Options): Setup {
  const records = seed(options.messages, options.users);
  const stores = new Map<string, unknown>(Object.entries(records));
  collectGarbage();
  const empty = getHeapStatistics().used_heap_size;
  const runtime = createRuntime({
    env: defaultEnvironment,
    store: (name) => stores.get(name),
  });
  const driver: Driver = createSimpleDriver(TAGS);
  const instances = reached(runtime, driver);
  const expected =
    1 + options.messages + Math.min(options.users, options.messages);
  if (instances !== expected)
    throw new Error(`Expected ${expected} instances, got ${instances}`);
  collectGarbage();
  const warmHeap = getHeapStatistics().used_heap_size - empty;
  return { runtime, driver, instances, warmHeap };
}

/** Instances the first run reaches, its result dropped. */
function reached(runtime: Runtime, driver: Driver): number {
  const result = settled(runtime.immediateQuery(room, 0, driver));
  if ("initialResult" in result)
    throw new Error("The simple driver answers whole");
  return result.output.instances.size;
}

async function repeat(
  scenario: Scenario,
  setup: Setup,
  runs: number,
): Promise<void> {
  for (let index = 0; index < runs; index++) {
    const ran = scenario.run(setup);
    if (ran !== undefined) await ran;
  }
}

// Exact measurement

type Exact = {
  readonly bytesPerRun: number;
  readonly retainedPerRun: number;
  readonly collections: number;
};

function collectGarbage(): void {
  const gc = globalThis.gc;
  if (gc === undefined)
    throw new Error("Run with --expose-gc, as `yarn bench:garbage` does");
  gc();
  gc();
}

/** Bytes allocated per run, from heap growth across `runs` runs during which nothing is collected. */
async function measureExact(
  scenario: Scenario,
  setup: Setup,
  runs: number,
): Promise<Exact> {
  let collections = 0;
  const observer = new PerformanceObserver((list) => {
    collections += list.getEntries().length;
  });
  collectGarbage();
  observer.observe({ entryTypes: ["gc"] });
  const before = getHeapStatistics().used_heap_size;
  await repeat(scenario, setup, runs);
  const after = getHeapStatistics().used_heap_size;
  // Entries arrive asynchronously: wait for those of collections during the runs.
  await new Promise((resolve) => setImmediate(resolve));
  observer.disconnect();
  const observed = collections;
  collectGarbage();
  const retained = getHeapStatistics().used_heap_size;
  return {
    bytesPerRun: (after - before) / runs,
    retainedPerRun: (retained - before) / runs,
    collections: observed,
  };
}

// Sampled attribution

type CallFrame = {
  readonly functionName: string;
  readonly url: string;
  readonly lineNumber: number;
  readonly columnNumber: number;
};

type ProfileNode = {
  readonly callFrame: CallFrame;
  readonly selfSize: number;
  readonly children: readonly ProfileNode[];
};

type Site = { bytes: number; readonly via: Map<string, number> };

const ROOT = fileURLToPath(new URL("../../", import.meta.url));

function pathOf(url: string): string {
  return url.startsWith("file:") ? fileURLToPath(url) : url;
}

/** `name (file:line)`, at the line of the TypeScript source when a source map tells it. */
function describeFrame(frame: CallFrame): string {
  const name = frame.functionName === "" ? "(anonymous)" : frame.functionName;
  if (frame.url === "") return `${name} (native)`;
  let file = pathOf(frame.url);
  let line = frame.lineNumber + 1;
  const entry = findSourceMap(file)?.findEntry(
    frame.lineNumber,
    frame.columnNumber,
  );
  if (entry !== undefined && "originalSource" in entry) {
    file = pathOf(entry.originalSource);
    line = entry.originalLine + 1;
  }
  if (file.startsWith(ROOT))
    file = file.slice(ROOT.length).replaceAll("\\", "/");
  return `${name} (${file}:${line})`;
}

/** Whether the frame runs the repository's code, rather than Node's or a library's. */
function isOwn(frame: CallFrame): boolean {
  if (!frame.url.startsWith("file:")) return false;
  const file = fileURLToPath(frame.url);
  return file.startsWith(ROOT) && !file.includes("node_modules");
}

/**
 * Bytes each function of the repository allocated per run, sampled: an allocation in a
 * native or library frame counts toward the nearest repository frame calling it, `via` the
 * first frame outside the repository.
 */
async function measureSites(
  scenario: Scenario,
  setup: Setup,
  runs: number,
): Promise<Map<string, Site>> {
  const session = new Session();
  session.connect();
  collectGarbage();
  await session.post("HeapProfiler.startSampling", {
    samplingInterval: 32,
    includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true,
  });
  await repeat(scenario, setup, runs);
  const { profile } = await session.post("HeapProfiler.stopSampling");
  session.disconnect();
  const sites = new Map<string, Site>();
  const names = new Map<CallFrame, string>();
  const nameOf = (frame: CallFrame): string => {
    let name = names.get(frame);
    if (name === undefined) {
      name = describeFrame(frame);
      names.set(frame, name);
    }
    return name;
  };
  const visit = (
    node: ProfileNode,
    own: CallFrame | undefined,
    via: CallFrame | undefined,
  ) => {
    const frame = node.callFrame;
    const mine = isOwn(frame);
    const site = mine ? frame : own;
    const through = mine ? undefined : via ?? frame;
    if (node.selfSize > 0 && site !== undefined) {
      const key = nameOf(site);
      let found = sites.get(key);
      if (found === undefined) {
        found = { bytes: 0, via: new Map() };
        sites.set(key, found);
      }
      found.bytes += node.selfSize / runs;
      const by = through === undefined ? "(itself)" : nameOf(through);
      found.via.set(by, (found.via.get(by) ?? 0) + node.selfSize / runs);
    }
    for (const child of node.children) visit(child, site, through);
  };
  visit(profile.head, undefined, undefined);
  return sites;
}

// Report

function format(bytes: number): string {
  return Math.round(bytes).toLocaleString("en-US").padStart(9);
}

function report(
  name: string,
  description: string,
  setup: Setup,
  exact: Exact,
  sites: Map<string, Site>,
  top: number,
): void {
  console.log(`\n## ${name}: ${description}`);
  console.log(
    `${format(exact.bytesPerRun).trim()} bytes per run, ` +
      `${(exact.bytesPerRun / setup.instances).toFixed(
        0,
      )} per instance reached (${setup.instances}), ` +
      `${format(exact.retainedPerRun).trim()} retained per run`,
  );
  console.log(
    `warm runtime holds ${format(setup.warmHeap).trim()} bytes, ` +
      `${(setup.warmHeap / setup.instances).toFixed(0)} per instance`,
  );
  if (exact.collections > 0) {
    console.log(
      `warning: ${exact.collections} collections during the exact batch undercount it: ` +
        `raise --max-semi-space-size or lower --runs`,
    );
  }
  let total = 0;
  for (const site of sites.values()) total += site.bytes;
  console.log(`sampled: ${format(total).trim()} bytes per run\n`);
  console.log(
    `${"bytes/run".padStart(9)}  ${"share".padStart(
      5,
    )}  function, and the call outside the repository that allocated`,
  );
  const ranked = [...sites]
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .slice(0, top);
  for (const [site, { bytes, via }] of ranked) {
    console.log(
      `${format(bytes)}  ${`${((bytes / total) * 100).toFixed(1)}%`.padStart(
        5,
      )}  ${site}`,
    );
    const calls = [...via]
      .sort((a, b) => b[1] - a[1])
      .filter(([, each]) => each >= 1);
    if (calls.length === 1 && calls[0]?.[0] === "(itself)") continue;
    for (const [call, each] of calls.slice(0, 4))
      console.log(`${format(each)}         ↳ ${call}`);
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const chosen = SCENARIOS.filter(
    (scenario) =>
      options.scenario === undefined || scenario.name === options.scenario,
  );
  if (chosen.length === 0) throw new Error(`No scenario "${options.scenario}"`);
  console.log(
    `Workload: 1 room, ${options.messages} messages, ${options.users} users; ` +
      `every view memoized, no store changes, ${options.runs} runs measured.`,
  );
  for (const scenario of chosen) {
    const setup = setUp(options);
    await repeat(scenario, setup, Math.max(200, options.runs / 4));
    const exact = await measureExact(scenario, setup, options.runs);
    const sites = await measureSites(scenario, setup, options.runs);
    report(
      scenario.name,
      scenario.description,
      setup,
      exact,
      sites,
      options.top,
    );
    setup.runtime.dispose();
  }
}

await main();
