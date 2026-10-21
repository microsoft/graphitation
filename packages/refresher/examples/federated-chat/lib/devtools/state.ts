/**
 * The devtools' own state: one store, as the application keeps its UI's. What the inspectors
 * answer and the activity they trace are written into it as they arrive; the devtools' actions
 * write the rest.
 */
import { storeView } from "../../../../src/index";
import type {
  ChangeFeed,
  StoreChange,
  StoreChangeListener,
  StoreViewContext,
} from "../../../../src/index";
import type { ActionContext, WritableStore } from "../actions";
import type {
  FromInspector,
  StoreInfo,
  ToInspector,
  TracedMessage,
  TraceEvent,
  ViewInfo,
} from "./protocol";

export type Tab = "activity" | "stores" | "views";

type Settled = Extract<TraceEvent, { readonly kind: "settled" }>;

/** A traced event, as the activity tab places it: every kind but what settles another. */
export type Entry = Exclude<TraceEvent, { readonly kind: "settled" }> & {
  /** `side:seq`: unique across sides. */
  readonly key: string;
  /**
   * By key, in order: a pass's queries, or an action's reads and the actions it ran or
   * answered with.
   */
  readonly children: readonly string[];
  /** An action sent to another runtime to run: the message that carried it there. */
  readonly sent: TracedMessage | null;
  /** What a query or action answered or threw; `null` until it settles. */
  readonly settled: Omit<Settled, "side" | "seq" | "at" | "kind" | "of"> | null;
};

/** An entry the timeline lists: queries and actions are listed in what they are children of. */
export type Placed = {
  readonly key: string;
  readonly side: string;
  readonly at: number;
  readonly seq: number;
};

/** A card in the views tab: a watch's latest result, or what a run answered. */
export type Frame = {
  readonly key: string;
  readonly side: string;
  readonly title: string;
  /** Watched, so it stays live until closed. */
  readonly live: boolean;
};

/** What an inspector last answered for a key. */
export type Answer = {
  readonly value: unknown;
  readonly errors: readonly string[];
  readonly failed: string | null;
};

/** What an inspector listed. */
export type Listed = {
  readonly views: readonly ViewInfo[];
  readonly stores: readonly StoreInfo[];
};

export type DevtoolsState = {
  readonly tab: Tab;
  /** The side the activity tab shows alone; `null` shows every side. */
  readonly shown: string | null;
  /** The store whose entries the stores tab shows, and the key of its watch. */
  readonly selected: {
    readonly side: string;
    readonly store: string;
    readonly key: string;
  } | null;
  /** Newest first. */
  readonly frames: readonly Frame[];
  /** Every side's entries on one time axis, oldest first. */
  readonly timeline: readonly Placed[];
  /** The runtimes inspected, in the order they connected. */
  readonly sides: readonly string[];
  /** What the devtools' last failed action threw. */
  readonly error: string | null;
  /** The milliseconds every message from the worker is delayed by. */
  readonly latency: number;
};

/** How many entries the timeline keeps. */
const TIMELINE = 400;

/** What links a wire entry to its counterpart: the sender's `n`th out is the receiver's `n`th in. */
export const wireLink = (
  entry: Extract<Entry, { readonly kind: "wire" }>,
): string =>
  entry.direction === "out"
    ? `wire:${entry.side}>${entry.peer}#${entry.n}`
    : `wire:${entry.peer}>${entry.side}#${entry.n}`;

/**
 * What links an action `from` sent in its `n`th message to `to` with the action `to` ran for
 * it: `/sent` names the one, `/ran` the other.
 */
export const runLink = (from: string, to: string, n: number): string =>
  `run:${from}>${to}#${n}`;

/** What links to a side's revision entry. */
export const revisionLink = (side: string, revision: number): string =>
  `revision:${side}:${revision}`;

/** The links an entry is found by. */
function linksOf(entry: Entry): string[] {
  if (entry.kind === "revision")
    return [revisionLink(entry.side, entry.revision)];
  if (entry.kind === "wire") return [`${wireLink(entry)}/${entry.direction}`];
  if (entry.kind !== "action") return [];
  const found: string[] = [];
  if (entry.via !== null)
    found.push(`${runLink(entry.via.peer, entry.side, entry.via.n)}/ran`);
  if (entry.sent !== null)
    found.push(`${runLink(entry.side, entry.sent.peer, entry.sent.n)}/sent`);
  return found;
}

export type DevtoolsHandle = ChangeFeed & {
  get<K extends keyof DevtoolsState>(key: K): DevtoolsState[K];
  set(patch: Partial<DevtoolsState>): void;
  entry(key: string): Entry | undefined;
  /** Whether a detail of an entry shows. */
  expanded(id: string): boolean;
  /** The key of the entry a link names. */
  link(id: string): string | undefined;
  /** A token, new on every focus, while the entry is focused. */
  focused(key: string): number | undefined;
  listed(side: string): Listed | undefined;
  answer(key: string): Answer | undefined;
  /** Logs traced events, dropping the oldest entries beyond what the timeline keeps. */
  log(events: readonly TraceEvent[]): void;
  /** Shows or hides a detail. */
  toggle(id: string): void;
  /**
   * Focuses an entry, showing its side if the activity tab shows another alone, and
   * expanding it if it is a store change: a chip to one asks what changed.
   */
  focus(key: string): void;
  clearActivity(): void;
  /** Takes in what a side's inspector answered. */
  receive(
    side: string,
    message: Exclude<FromInspector, { readonly type: "trace" }>,
  ): void;
  /** Lets go of what was answered for `key`. */
  forget(key: string): void;
};

/** The store's changes: each names what it changed, as its views match. */
const changed = (value: string): StoreChange => ({
  store: "devtools",
  operation: "set",
  value,
});

export function createDevtoolsHandle(): DevtoolsHandle {
  let state: DevtoolsState = {
    tab: "activity",
    shown: null,
    selected: null,
    frames: [],
    timeline: [],
    sides: [],
    error: null,
    latency: 0,
  };
  const entries = new Map<string, Entry>();
  const expanded = new Set<string>();
  const links = new Map<string, string>();
  let focus: { readonly key: string; readonly token: number } | undefined;
  let tokens = 0;
  const listed = new Map<string, Listed>();
  const answers = new Map<string, Answer>();
  const listeners = new Set<StoreChangeListener>();
  let revision = 0;

  const announce = (changes: readonly StoreChange[]): void => {
    if (changes.length === 0) return;
    revision++;
    for (const listener of listeners) listener(changes, revision);
  };

  /** Earlier on the time axis: by stamp, then side, then within a side by `seq`. */
  const before = (a: Placed, b: Placed): boolean => {
    if (a.at !== b.at) return a.at < b.at;
    if (a.side !== b.side)
      return state.sides.indexOf(a.side) < state.sides.indexOf(b.side);
    return a.seq < b.seq;
  };

  /** Drops an entry, its children, and what they are found by. */
  const drop = (key: string, touched: Set<string>): void => {
    const entry = entries.get(key);
    if (entry === undefined) return;
    entries.delete(key);
    touched.add(`entry:${key}`);
    for (const link of linksOf(entry)) {
      if (links.get(link) === key) links.delete(link);
      touched.add(`link:${link}`);
    }
    for (const id of expanded)
      if (id === key || id.startsWith(`${key}/`)) expanded.delete(id);
    for (const child of entry.children) drop(child, touched);
  };

  return {
    get: (key) => state[key],
    set(patch) {
      const keys = Object.keys(patch).filter(
        (key) => Reflect.get(patch, key) !== Reflect.get(state, key),
      );
      state = { ...state, ...patch };
      announce(keys.map(changed));
    },
    entry: (key) => entries.get(key),
    expanded: (id) => expanded.has(id),
    link: (id) => links.get(id),
    focused: (key) => (focus?.key === key ? focus.token : undefined),
    listed: (side) => listed.get(side),
    answer: (key) => answers.get(key),
    log(traced) {
      if (traced.length === 0) return;
      const touched = new Set<string>();
      const timeline = [...state.timeline];
      for (const event of traced) {
        if (event.kind === "settled") {
          const target = entries.get(`${event.side}:${event.of}`);
          if (target === undefined) continue;
          const { failed, took, summary, instances, payload } = event;
          entries.set(target.key, {
            ...target,
            settled: { failed, took, summary, instances, payload },
          });
          touched.add(`entry:${target.key}`);
          continue;
        }
        const key = `${event.side}:${event.seq}`;
        const entry: Entry = {
          ...event,
          key,
          children: [],
          sent: null,
          settled: null,
        };
        entries.set(key, entry);
        for (const link of linksOf(entry)) {
          links.set(link, key);
          touched.add(`link:${link}`);
        }
        if (event.kind === "wire" && event.carries !== null) {
          const carried = entries.get(`${event.side}:${event.carries}`);
          if (carried !== undefined) {
            const sent: Entry = {
              ...carried,
              sent: { peer: event.peer, n: event.n },
            };
            entries.set(sent.key, sent);
            touched.add(`entry:${sent.key}`);
            for (const link of linksOf(sent)) {
              links.set(link, sent.key);
              touched.add(`link:${link}`);
            }
          }
        }
        const parent =
          event.kind === "query" || event.kind === "action"
            ? event.parent
            : null;
        if (parent !== null) {
          const of = entries.get(`${event.side}:${parent}`);
          if (of !== undefined) {
            entries.set(of.key, { ...of, children: [...of.children, key] });
            touched.add(`entry:${of.key}`);
          }
          continue;
        }
        // Each side's events arrive in order: an entry goes at the end, or close to it.
        const placed: Placed = {
          key,
          side: event.side,
          at: event.at,
          seq: event.seq,
        };
        let index = timeline.length;
        while (index > 0 && before(placed, timeline[index - 1]!)) index--;
        timeline.splice(index, 0, placed);
      }
      for (const dropped of timeline.splice(
        0,
        Math.max(0, timeline.length - TIMELINE),
      )) {
        drop(dropped.key, touched);
      }
      if (timeline.length !== state.timeline.length || touched.size > 0) {
        state = { ...state, timeline };
        touched.add("timeline");
      }
      announce([...touched].map(changed));
    },
    toggle(id) {
      if (!expanded.delete(id)) expanded.add(id);
      announce([changed(`expanded:${id}`)]);
    },
    focus(key) {
      const entry = entries.get(key);
      if (entry === undefined) return;
      const touched = [changed(`focused:${key}`)];
      if (focus !== undefined && focus.key !== key)
        touched.push(changed(`focused:${focus.key}`));
      focus = { key, token: ++tokens };
      if (entry.kind === "revision" && !expanded.has(key)) {
        expanded.add(key);
        touched.push(changed(`expanded:${key}`));
      }
      if (state.shown !== null && state.shown !== entry.side) {
        state = { ...state, shown: entry.side };
        touched.push(changed("shown"));
      }
      announce(touched);
    },
    clearActivity() {
      entries.clear();
      expanded.clear();
      links.clear();
      focus = undefined;
      state = { ...state, timeline: [] };
      announce([changed("timeline")]);
    },
    receive(side, message) {
      if (message.type === "listed") {
        listed.set(side, { views: message.views, stores: message.stores });
        announce([changed(`listed:${side}`)]);
      } else {
        answers.set(
          message.key,
          message.type === "result"
            ? { value: message.value, errors: message.errors, failed: null }
            : { value: undefined, errors: [], failed: message.message },
        );
        announce([changed(`answer:${message.key}`)]);
      }
    },
    forget(key) {
      if (answers.delete(key)) announce([changed(`answer:${key}`)]);
    },
    subscribe(listener) {
      listeners.add(listener);
      listener([], revision);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
/** One field of the state: a view that reads it runs again only when it changes. */
const field = <K extends keyof DevtoolsState>(key: K) =>
  // Named in full: inference cannot see through a key not yet chosen.
  storeView<
    undefined,
    DevtoolsState[K],
    DevtoolsHandle,
    Record<string, never>,
    DevtoolsState[K],
    unknown
  >({
    store: "devtools",
    name: `devtools ${key}`,
    resolve: (_args, { store }) => store.get(key),
    matches: (_args, change) => change.value === key,
  });

const views = {
  tab: field("tab"),
  selected: field("selected"),
  frames: field("frames"),
  timeline: field("timeline"),
  shown: field("shown"),
  sides: field("sides"),
  error: field("error"),
  latency: field("latency"),
  /** A traced entry; `null` once dropped. */
  entry: storeView({
    store: "devtools",
    name: "devtools entry",
    resolve: (key: string, { store }: StoreViewContext<DevtoolsHandle>) =>
      store.entry(key) ?? null,
    matches: (key, change) => change.value === `entry:${key}`,
  }),
  /** Whether a detail shows. */
  expanded: storeView({
    store: "devtools",
    name: "devtools expanded",
    resolve: (id: string, { store }: StoreViewContext<DevtoolsHandle>) =>
      store.expanded(id),
    matches: (id, change) => change.value === `expanded:${id}`,
  }),
  /** The key of the entry a link names; `null` while none is logged. */
  link: storeView({
    store: "devtools",
    name: "devtools link",
    resolve: (id: string, { store }: StoreViewContext<DevtoolsHandle>) =>
      store.link(id) ?? null,
    matches: (id, change) => change.value === `link:${id}`,
  }),
  /** A token, new on every focus, while the entry is focused; `null` otherwise. */
  focused: storeView({
    store: "devtools",
    name: "devtools focused",
    resolve: (key: string, { store }: StoreViewContext<DevtoolsHandle>) =>
      store.focused(key) ?? null,
    matches: (key, change) => change.value === `focused:${key}`,
  }),
  /** What a side's inspector listed; `null` until it did. */
  listed: storeView({
    store: "devtools",
    name: "devtools listed",
    resolve: (side: string, { store }: StoreViewContext<DevtoolsHandle>) =>
      store.listed(side) ?? null,
    matches: (side, change) => change.value === `listed:${side}`,
  }),
  /** What an inspector last answered for a key; `null` until it did. */
  answer: storeView({
    store: "devtools",
    name: "devtools answer",
    resolve: (key: string, { store }: StoreViewContext<DevtoolsHandle>) =>
      store.answer(key) ?? null,
    matches: (key, change) => change.value === `answer:${key}`,
  }),
};

/** The devtools' store: its views, and its handle as the writer actions open. */
export const devtools: WritableStore<DevtoolsHandle> & typeof views = {
  name: "devtools",
  ...views,
};

/** What the devtools' actions need besides Refresher's context. */
export type DevtoolsServices = {
  /** Sends a message to a side's inspector. */
  readonly send: (side: string, message: ToInspector) => void;
  /** A key no other watch, run or edit has. */
  readonly key: () => string;
  /** Edits a side's store: settles once the inspector did, rejecting with what it threw. */
  readonly edit: (
    side: string,
    edit: Omit<Edit, "type" | "key">,
  ) => Promise<void>;
};

type Edit = Extract<ToInspector, { readonly type: "edit" }>;

export type DevtoolsContext = ActionContext<DevtoolsServices>;
