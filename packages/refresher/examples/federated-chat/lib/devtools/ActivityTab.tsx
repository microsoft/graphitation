/**
 * Every side's activity on one time axis, a column per side, newest at the bottom: each
 * store change, each batch of queries a pass ran or updated live and why, each action with
 * what it read and the actions it ran, and each message between sides, each one line that
 * expands on click. Chips focus what an entry links to: the revision a pass ran at or a
 * change came in, the other end of a message, or of an action another side ran.
 */
import { Fragment } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { view } from "../../../../src/index";
import type {
  External,
  Ref,
  ResolveContext,
  ResultOf,
} from "../../../../src/index";
import { render, useData, useHandler } from "../react";
import type { DataRef } from "../react";
import { devtools, revisionLink, runLink, wireLink } from "./state";
import type { DevtoolsContext, Entry } from "./state";
import { Label } from "./Label";
import type { TracedInstance } from "./protocol";
import { Value, valueActions } from "./Value";
import type { ValueActions } from "./Value";

export function showSide(
  side: string | null,
  { store }: DevtoolsContext,
): void {
  store(devtools).set({ shown: side });
}

/** The delays the activity tab offers, in milliseconds. */
const LATENCIES = [0, 100, 250, 500, 1000, 2000, 5000];

/** Handles the latency select's change: delays every message from the worker by its value. */
export function setLatency(
  _args: undefined,
  { store }: DevtoolsContext,
  event: ChangeEvent<HTMLSelectElement>,
): void {
  store(devtools).set({ latency: Number(event.currentTarget.value) });
}

export function clearActivity(
  _args: undefined,
  { store }: DevtoolsContext,
): void {
  store(devtools).clearActivity();
}

export function toggleDetail(id: string, { store }: DevtoolsContext): void {
  store(devtools).toggle(id);
}

export function focusEntry(key: string, { store }: DevtoolsContext): void {
  store(devtools).focus(key);
}

const pad = (value: number, length = 2): string =>
  String(value).padStart(length, "0");

/** A time on the hybrid clocks, as the wall clock it is close to, to the millisecond. */
const timeOf = (at: number): string => {
  const date = new Date(at);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds(),
  )}.${pad(date.getMilliseconds(), 3)}`;
};

/** A value that shows only while expanded: it is read only then. */
const detail = (
  { read, action }: ResolveContext,
  id: string,
  value: unknown,
) => {
  const open = read(devtools.expanded, id);
  return { open, toggle: action(toggleDetail, id), value: open ? value : null };
};

/** Focuses the entry a link names; `null` while none is logged. */
const chip = ({ read, action }: ResolveContext, link: string) => {
  const target = read(devtools.link, link);
  return target === null ? null : action(focusEntry, target);
};

const revisionChip = (
  context: ResolveContext,
  side: string,
  revision: number,
) => ({
  time: timeOf(revision),
  revision,
  focus: chip(context, revisionLink(side, revision)),
});

/**
 * An instance's two parts, each expanding on its own: the store reads it depends on, each
 * with a chip to the revision its answer reflects, and its data. A kept pin has no reads,
 * and its data, the ref it keeps, shows at once.
 */
const partsOf = (
  context: ResolveContext,
  side: string,
  id: string,
  instance: TracedInstance,
) => {
  const reads = expansion(context, `${id}/reads`);
  return {
    pinned: instance.pinned,
    reads: {
      ...reads,
      count: instance.reads.length,
      list: reads.open
        ? instance.reads.map((read) => ({
            ...read,
            at: revisionChip(context, side, read.revision),
          }))
        : [],
    },
    data: instance.pinned
      ? { open: true, toggle: reads.toggle, value: instance.data }
      : detail(context, `${id}/data`, instance.data),
  };
};

const settledOf = (settled: Entry["settled"]) =>
  settled === null
    ? null
    : { summary: settled.summary, failed: settled.failed, took: settled.took };

/** Whether an entry shows more than its line, and the action that toggles it. */
const expansion = ({ read, action }: ResolveContext, key: string) => ({
  open: read(devtools.expanded, key),
  toggle: action(toggleDetail, key),
});

/** A query a pass ran: one line, expanding to why it ran and what it evaluated. */
export const activityQueryView = view({
  name: "Activity query",
  resolve: (key: string, context) => {
    const entry = context.read(devtools.entry, key);
    if (entry?.kind !== "query") return null;
    const { open, toggle } = expansion(context, key);
    const instances = entry.settled?.instances ?? [];
    // A read's one instance is the view it wraps: shown under its line, not again as a line.
    const lone =
      entry.immediate && instances.length === 1 ? instances[0] : undefined;
    return {
      key,
      focused: context.read(devtools.focused, key),
      ...(entry.immediate
        ? { verb: "read", tone: "read" }
        : entry.restart
        ? { verb: "live update", tone: "update" }
        : { verb: "query", tone: "query" }),
      // Its badge says read already.
      roots: entry.immediate
        ? entry.roots.map((root) => root.replace(/^read /, ""))
        : entry.roots,
      open,
      toggle,
      hits: open
        ? entry.hits.map((hit) =>
            hit.kind === "hit"
              ? { ...hit, at: revisionChip(context, entry.side, hit.revision) }
              : { ...hit, at: null },
          )
        : [],
      settled: settledOf(entry.settled),
      read:
        open && lone !== undefined
          ? partsOf(context, entry.side, `${key}/read`, lone)
          : null,
      instances:
        open && lone === undefined
          ? instances.map((instance, index) => {
              const id = `${key}/i${index}`;
              const shown = expansion(context, id);
              return {
                label: instance.label,
                errors: instance.errors,
                open: shown.open,
                toggle: shown.toggle,
                parts: shown.open
                  ? partsOf(context, entry.side, id, instance)
                  : null,
              };
            })
          : [],
      actions: valueActions(entry.side, context),
    };
  },
});

export type QueryData = ResultOf<typeof activityQueryView>;

/**
 * An action's own line, expanding to its arguments and answer: one sent to another side
 * links to the action it ran there, and one run for another side to the one sent.
 */
export const activityActionView = view({
  name: "Activity action",
  resolve: (key: string, context) => {
    const entry = context.read(devtools.entry, key);
    if (entry?.kind !== "action") return null;
    const { sent, via } = entry;
    return {
      key,
      focused: context.read(devtools.focused, key),
      label: entry.label,
      // The peer only: the chip beside it shows which way.
      badge: entry.remote
        ? `action ${sent?.peer ?? "…"}`
        : via === null
        ? "action"
        : `action ${via.peer}`,
      settled: settledOf(entry.settled),
      payload: detail(context, key, {
        args: entry.args,
        ...(entry.inputs === null ? {} : { inputs: entry.inputs }),
        ...entry.settled?.payload,
      }),
      link:
        sent !== null
          ? {
              glyph: "⇢",
              title: `Show it run in ${sent.peer}`,
              focus: chip(
                context,
                `${runLink(entry.side, sent.peer, sent.n)}/ran`,
              ),
            }
          : via !== null
          ? {
              glyph: "⇠",
              title: `Show it sent from ${via.peer}`,
              focus: chip(
                context,
                `${runLink(via.peer, entry.side, via.n)}/sent`,
              ),
            }
          : null,
      actions: valueActions(entry.side, context),
    };
  },
});

export type ActionData = ResultOf<typeof activityActionView>;

/** An action, with what it read and the actions it ran, in order. */
export type ActionNode = {
  readonly line: Ref<ActionData, string>;
  readonly children: readonly ActionChild[];
};

export type ActionChild =
  | {
      readonly kind: "read";
      readonly key: string;
      readonly query: Ref<QueryData, string>;
    }
  | {
      readonly kind: "action";
      readonly key: string;
      readonly node: ActionNode;
    };

/** The action `key`, and its children's, as deep as they go. */
const actionNode = (context: ResolveContext, key: string): ActionNode => ({
  line: context.ref(activityActionView, key, render),
  children: (context.read(devtools.entry, key)?.children ?? []).flatMap(
    (child): ActionChild[] => {
      const kind = context.read(devtools.entry, child)?.kind;
      if (kind === "query") {
        return [
          {
            kind: "read",
            key: child,
            query: context.ref(activityQueryView, child, render),
          },
        ];
      }
      if (kind === "action")
        return [
          { kind: "action", key: child, node: actionNode(context, child) },
        ];
      return [];
    },
  ),
});

/** One entry on the timeline, by kind; `null` once dropped. */
export const activityEntryView = view({
  name: "Activity entry",
  resolve: (key: string, context) => {
    const entry = context.read(devtools.entry, key);
    if (entry === null) return null;
    const common = {
      key,
      side: entry.side,
      time: timeOf(entry.at),
      focused: context.read(devtools.focused, key),
      actions: valueActions(entry.side, context),
    };
    switch (entry.kind) {
      case "revision": {
        const { open, toggle } = expansion(context, key);
        return {
          ...common,
          kind: entry.kind,
          open,
          toggle,
          summary:
            entry.changes.length === 0
              ? "clock only"
              : entry.changes
                  .map(
                    (change) =>
                      `${change.store} ${change.operation} ${change.label}`,
                  )
                  .join(", "),
          changes: open
            ? entry.changes.map((change, index) => ({
                store: change.store,
                operation: change.operation,
                label: change.label,
                value: detail(context, `${key}/c${index}`, change.value),
              }))
            : [],
        };
      }
      case "pass":
        // Always open: its queries are its whole content.
        return {
          ...common,
          kind: entry.kind,
          at: revisionChip(context, entry.side, entry.revision),
          queries: entry.children.map((query) =>
            context.ref(activityQueryView, query, render),
          ),
        };
      case "action":
        // Its line is focused, not the entry: nested ones are lines too.
        return {
          ...common,
          focused: null,
          kind: entry.kind,
          node: actionNode(context, key),
        };
      case "wire":
        return {
          ...common,
          kind: entry.kind,
          peer: entry.peer,
          direction: entry.direction,
          n: entry.n,
          summary: entry.summary,
          failed: entry.failed,
          counterpart: chip(
            context,
            `${wireLink(entry)}/${entry.direction === "out" ? "in" : "out"}`,
          ),
          payload: detail(context, key, entry.payload),
        };
      default:
        // A query: listed in its pass, or its action.
        return null;
    }
  },
});

export type EntryData = ResultOf<typeof activityEntryView>;

/** The timeline, as the sides shown lay it out. */
export const activityTabView = view({
  name: "Activity tab",
  resolve: (_args: undefined, { read, ref, action }) => {
    const sides = read(devtools.sides);
    const shown = read(devtools.shown);
    const lanes = shown === null ? sides : [shown];
    const toggle = (side: string | null) => ({
      label: side ?? "both",
      current: shown === side,
      select: action(showSide, side),
    });
    const [first, ...rest] = sides.map(toggle);
    return {
      toggles: first === undefined ? [] : [first, toggle(null), ...rest],
      latency: read(devtools.latency),
      setLatency: action(setLatency),
      clear: action(clearActivity),
      lanes,
      rows: read(devtools.timeline)
        .filter((placed) => lanes.includes(placed.side))
        .map((placed) => ({
          key: placed.key,
          lane: lanes.indexOf(placed.side),
          entry: ref(activityEntryView, placed.key, render),
        })),
    };
  },
});

type Expandable = { readonly open: boolean; readonly value: unknown };

/** A detail's value, while expanded. */
function Detail({
  detail: expandable,
  actions,
}: {
  readonly detail: Expandable;
  readonly actions: ValueActions;
}): ReactNode {
  if (!expandable.open) return null;
  return (
    <div className="dt-payload">
      <Value value={expandable.value} actions={actions} bare />
    </div>
  );
}

/** An entry, as a component receives it. */
type Shown = NonNullable<External<EntryData, unknown>>;

type RevisionAt = Extract<Shown, { readonly kind: "pass" }>["at"];

/** Focuses what it links to: a revision, by its time. */
function RevisionChip({ at }: { readonly at: RevisionAt }): ReactNode {
  const handler = useHandler();
  if (at.focus === null) {
    return (
      <span className="dt-chip" title={`r${at.revision}`}>
        r {at.time}
      </span>
    );
  }
  return (
    <button
      type="button"
      className="dt-chip"
      title={`r${at.revision}: show it`}
      onClick={handler(at.focus)}
    >
      r {at.time}
    </button>
  );
}

/**
 * Takes focus as it mounts, so the browser scrolls it into view: a new token on every
 * focus mounts a new one.
 */
function Anchor({ token }: { readonly token: number | null }): ReactNode {
  if (token === null) return null;
  return (
    <button
      key={token}
      type="button"
      className="dt-anchor"
      tabIndex={-1}
      autoFocus
      aria-label="Focused"
    />
  );
}

type Toggle = Extract<Shown, { readonly kind: "revision" }>["toggle"];

/** An entry's one line: expands it on click, and keeps `trailing` (a chip) unclipped. */
function Line({
  open,
  toggle,
  failed = false,
  trailing = null,
  children,
}: {
  readonly open: boolean;
  readonly toggle: Toggle;
  readonly failed?: boolean;
  readonly trailing?: ReactNode;
  readonly children: ReactNode;
}): ReactNode {
  const handler = useHandler();
  return (
    <div className="dt-entry-line">
      <button
        type="button"
        className={failed ? "dt-failed" : undefined}
        aria-expanded={open}
        onClick={handler(toggle)}
      >
        {open ? "▾" : "▸"} {children}
      </button>
      {trailing}
    </div>
  );
}

function Settled({
  settled,
}: {
  readonly settled: NonNullable<External<QueryData, unknown>>["settled"];
}) {
  if (settled === null) return <span className="dt-meta"> · running…</span>;
  return (
    <span className={settled.failed ? "dt-failed" : "dt-meta"}>
      {" "}
      · {settled.summary} · {settled.took} ms
    </span>
  );
}

type Parts = NonNullable<NonNullable<External<QueryData, unknown>>["read"]>;

/**
 * An instance's store reads, which a change must hit to rerun it, and its data: one key
 * each, folded until clicked.
 */
function InstanceParts({
  parts,
  actions,
}: {
  readonly parts: Parts;
  readonly actions: ValueActions;
}): ReactNode {
  const handler = useHandler();
  const { pinned, reads, data } = parts;
  if (pinned) {
    return (
      <div
        className="dt-pinned"
        title="A pin: the query keeps the ref it answered, and no change reruns it"
      >
        <Value value={data.value} actions={actions} bare refIcon="📌" />
      </div>
    );
  }
  return (
    <ul className="dt-instances">
      <li>
        <button
          type="button"
          aria-expanded={reads.open}
          onClick={handler(reads.toggle)}
        >
          {reads.open ? "▾" : "▸"} store reads{" "}
          <span className="dt-meta">· {reads.count}</span>
        </button>
        {reads.list.length > 0 && (
          <ul className="dt-reads">
            {reads.list.map((read, index) => (
              <li key={index}>
                <Label text={read.label} single /> <RevisionChip at={read.at} />
                {read.footprint !== null && (
                  <span className="dt-meta"> · covers {read.footprint}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </li>
      <li>
        <button
          type="button"
          aria-expanded={data.open}
          onClick={handler(data.toggle)}
        >
          {data.open ? "▾" : "▸"} data
        </button>
        <Detail detail={data} actions={actions} />
      </li>
    </ul>
  );
}

function Query({
  dataRef,
}: {
  readonly dataRef: DataRef<QueryData>;
}): ReactNode {
  const query = useData(dataRef);
  const handler = useHandler();
  if (query === null) return null;
  return (
    <li
      className={
        query.focused === null ? "dt-act-query" : "dt-act-query dt-focused"
      }
    >
      <Anchor token={query.focused} />
      <Line
        open={query.open}
        toggle={query.toggle}
        failed={query.settled?.failed === true}
      >
        <span className={`dt-badge dt-${query.tone}`}>{query.verb}</span>{" "}
        {query.roots.map((root, index) => (
          <Fragment key={index}>
            {index > 0 && ", "}
            <Label text={root} single />
          </Fragment>
        ))}
        <Settled settled={query.settled} />
      </Line>
      {query.hits.length > 0 && (
        <ul className="dt-hits">
          {query.hits.map((hit, index) => (
            <li key={index}>
              <span className="dt-meta">↯</span>{" "}
              {hit.kind === "hit" && hit.at !== null && (
                <>
                  <RevisionChip at={hit.at} />{" "}
                </>
              )}
              <Label text={hit.instance} single />{" "}
              {hit.kind === "hit" ? (
                <>
                  <span className="dt-meta">
                    by {hit.store} {hit.operation}
                  </span>{" "}
                  <Label text={hit.label} />
                </>
              ) : (
                <span className="dt-meta">
                  unverifiable: the log no longer holds its changes
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {query.read !== null && (
        <InstanceParts parts={query.read} actions={query.actions} />
      )}
      {query.instances.length > 0 && (
        <ul className="dt-instances">
          {query.instances.map((instance, index) => (
            <li key={index}>
              <button
                type="button"
                className={instance.errors.length > 0 ? "dt-failed" : undefined}
                aria-expanded={instance.open}
                onClick={handler(instance.toggle)}
              >
                {instance.open ? "▾" : "▸"}{" "}
                <Label text={instance.label} single />
                {instance.errors.length > 0 &&
                  ` · ${instance.errors.join("; ")}`}
              </button>
              {instance.parts !== null && (
                <InstanceParts parts={instance.parts} actions={query.actions} />
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function ActionLine({
  dataRef,
}: {
  readonly dataRef: DataRef<ActionData>;
}): ReactNode {
  const action = useData(dataRef);
  const handler = useHandler();
  if (action === null) return null;
  const { link } = action;
  return (
    <div
      className={
        action.focused === null ? "dt-action-line" : "dt-action-line dt-focused"
      }
    >
      <Anchor token={action.focused} />
      <Line
        open={action.payload.open}
        toggle={action.payload.toggle}
        failed={action.settled?.failed === true}
        trailing={
          link !== null &&
          link.focus !== null && (
            <button
              type="button"
              className="dt-chip"
              title={link.title}
              onClick={handler(link.focus)}
            >
              {link.glyph}
            </button>
          )
        }
      >
        <span className="dt-badge dt-action">{action.badge}</span>{" "}
        <Label text={action.label} single />
        <Settled settled={action.settled} />
      </Line>
      <Detail detail={action.payload} actions={action.actions} />
    </div>
  );
}

type ShownNode = Extract<Shown, { readonly kind: "action" }>["node"];

/** An action's line, and its reads and the actions it ran on a rail below it. */
function ActionTree({ node }: { readonly node: ShownNode }): ReactNode {
  return (
    <>
      <ActionLine dataRef={node.line} />
      {node.children.length > 0 && (
        <ul className="dt-queries dt-action-children">
          {node.children.map((child) =>
            child.kind === "read" ? (
              <Query key={child.key} dataRef={child.query} />
            ) : (
              <li key={child.key} className="dt-act-query">
                <ActionTree node={child.node} />
              </li>
            ),
          )}
        </ul>
      )}
    </>
  );
}

function Body({ entry }: { readonly entry: Shown }): ReactNode {
  const handler = useHandler();
  switch (entry.kind) {
    case "revision":
      return (
        <>
          <Line open={entry.open} toggle={entry.toggle}>
            <span className="dt-badge dt-revision">store change</span>{" "}
            <span
              className={entry.changes.length === 0 ? "dt-meta" : undefined}
            >
              <Label text={entry.summary} />
            </span>
          </Line>
          {entry.changes.length > 0 && (
            <ul className="dt-changes">
              {entry.changes.map((change, index) => (
                <li key={index}>
                  <button
                    type="button"
                    aria-expanded={change.value.open}
                    onClick={handler(change.value.toggle)}
                  >
                    {change.value.open ? "▾" : "▸"}{" "}
                    <span className="dt-key">{change.store}</span>{" "}
                    <span className="dt-meta">{change.operation}</span>{" "}
                    <Label text={change.label} />
                  </button>
                  <Detail detail={change.value} actions={entry.actions} />
                </li>
              ))}
            </ul>
          )}
        </>
      );
    case "pass":
      return (
        <>
          <div className="dt-batch-head">
            <span className="dt-badge dt-pass">batch</span>{" "}
            <span className="dt-meta">
              {entry.queries.length}{" "}
              {entry.queries.length === 1 ? "query" : "queries"}
            </span>
          </div>
          {entry.queries.length > 0 && (
            <ul className="dt-queries">
              {entry.queries.map((query) => (
                <Query key={query} dataRef={query} />
              ))}
            </ul>
          )}
        </>
      );
    case "action":
      return <ActionTree node={entry.node} />;
    case "wire":
      return (
        <>
          <Line
            open={entry.payload.open}
            toggle={entry.payload.toggle}
            failed={entry.failed}
            trailing={
              entry.counterpart !== null && (
                <button
                  type="button"
                  className="dt-chip"
                  title={`Show it ${
                    entry.direction === "out" ? "arrive" : "leave"
                  } in ${entry.peer}`}
                  onClick={handler(entry.counterpart)}
                >
                  {entry.direction === "out" ? "⇢" : "⇠"}
                </button>
              )
            }
          >
            <span className="dt-badge dt-wire">
              {entry.peer} #{entry.n}
            </span>{" "}
            <Label text={entry.summary} />
          </Line>
          <Detail detail={entry.payload} actions={entry.actions} />
        </>
      );
    default:
      return null;
  }
}

function ActivityEntry({
  dataRef,
}: {
  readonly dataRef: DataRef<EntryData>;
}): ReactNode {
  const entry = useData(dataRef);
  if (entry === null) return null;
  return (
    <div
      className={
        entry.focused === null
          ? `dt-act dt-act-${entry.kind}`
          : `dt-act dt-act-${entry.kind} dt-focused`
      }
    >
      <Anchor token={entry.focused} />
      {entry.kind === "pass" ? (
        // A batch runs at a revision: its time is that one, linked.
        <span className="dt-time">
          <RevisionChip at={entry.at} />
        </span>
      ) : (
        <span className="dt-meta dt-time">{entry.time}</span>
      )}
      <Body entry={entry} />
    </div>
  );
}

export function ActivityTab({
  dataRef,
}: {
  readonly dataRef: DataRef<ResultOf<typeof activityTabView>>;
}): ReactNode {
  const activity = useData(dataRef);
  const handler = useHandler();
  return (
    <div className="dt-activity">
      <div className="dt-toolbar">
        {activity.toggles.map((toggle) => (
          <button
            key={toggle.label}
            type="button"
            aria-pressed={toggle.current}
            onClick={handler(toggle.select)}
          >
            {toggle.label}
          </button>
        ))}
        <label
          className="dt-latency"
          title="Delays every message from the worker"
        >
          latency{" "}
          <select
            value={activity.latency}
            onChange={handler(activity.setLatency)}
          >
            {LATENCIES.map((ms) => (
              <option key={ms} value={ms}>
                {ms} ms
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={handler(activity.clear)}>
          Clear
        </button>
      </div>
      <div
        className="dt-lane-heads"
        style={{
          gridTemplateColumns: `repeat(${activity.lanes.length}, minmax(0, 1fr))`,
        }}
      >
        {activity.lanes.map((lane) => (
          <h3 key={lane}>{lane}</h3>
        ))}
      </div>
      {/* Reversed, so it stays scrolled to the bottom: the newest. */}
      <div className="dt-timeline">
        <ol
          className={`dt-lanes-${activity.lanes.length}`}
          style={{
            gridTemplateColumns: `repeat(${activity.lanes.length}, minmax(0, 1fr))`,
          }}
        >
          {activity.rows.map((row, index) => (
            // A row each: on one time axis, no two entries are side by side.
            <li
              key={row.key}
              style={{ gridColumn: row.lane + 1, gridRow: index + 1 }}
            >
              <ActivityEntry dataRef={row.entry} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
