/**
 * A described value as a tree, its markers live: a ref follows into a new frame, another
 * runtime's ref opens its view there, and an action ref runs, asking for its open inputs.
 */
import type { FormEvent, ReactNode } from "react";
import type { External, ResolveContext } from "../../../../src/index";
import { useHandler } from "../react";
import type { InputInfo } from "./describe";
import { Label } from "./Label";
import type { Target } from "./protocol";
import { devtools } from "./state";
import type { DevtoolsContext } from "./state";

/** How many frames the views tab keeps: the oldest close beyond. */
const FRAMES = 12;

/** Watches `target` on `side` in a new frame, on top, and shows the views tab. */
export function openFrame(
  { read, store, send, key }: DevtoolsContext,
  side: string,
  title: string,
  target: Target,
): void {
  const opened = key();
  const frames = [
    { key: opened, side, title, live: true },
    ...read(devtools.frames),
  ];
  for (const dropped of frames.splice(FRAMES)) {
    if (dropped.live) send(dropped.side, { type: "unwatch", key: dropped.key });
    store(devtools).forget(dropped.key);
  }
  store(devtools).set({ tab: "views", frames });
  send(side, { type: "watch", key: opened, target });
}

/** Follows a ref a result held. */
export function follow(
  {
    side,
    handle,
    title,
  }: { readonly side: string; readonly handle: number; readonly title: string },
  context: DevtoolsContext,
): void {
  openFrame(context, side, title, { kind: "ref", handle });
}

/** Opens the view another runtime's ref names, there. */
export function openRemote(
  {
    side,
    view,
    args,
    title,
  }: {
    readonly side: string;
    readonly view: string;
    readonly args: unknown;
    readonly title: string;
  },
  context: DevtoolsContext,
): void {
  openFrame(context, side, title, { kind: "view", view, args });
}

/** A form field as a value: JSON, or the text itself; `undefined` when empty. */
export function parseField(text: FormDataEntryValue | null): unknown {
  if (typeof text !== "string" || text.trim() === "") return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * Handles an action marker's submit: runs the action ref a result held, with the form's
 * fields as values for its open inputs, and shows what it answered in a new frame.
 */
export function runAction(
  {
    side,
    handle,
    title,
  }: { readonly side: string; readonly handle: number; readonly title: string },
  { read, store, send, key }: DevtoolsContext,
  event: FormEvent<HTMLFormElement>,
): void {
  event.preventDefault();
  const inputs: Record<string, unknown> = {};
  for (const [name, text] of new FormData(event.currentTarget)) {
    const value = parseField(text);
    if (value !== undefined) inputs[name] = value;
  }
  const ran = key();
  store(devtools).set({
    tab: "views",
    frames: [
      { key: ran, side, title: `ran ${title}`, live: false },
      ...read(devtools.frames),
    ],
  });
  send(side, { type: "run", key: ran, handle, inputs });
}

/** What a value's markers run, on the side that described it. */
export const valueActions = (
  side: string,
  { action, input }: ResolveContext,
) => ({
  follow: action(follow, {
    side,
    handle: input("handle"),
    title: input("title"),
  }),
  open: action(openRemote, {
    side: input("side"),
    view: input("view"),
    args: input("args"),
    title: input("title"),
  }),
  run: action(runAction, {
    side,
    handle: input("handle"),
    title: input("title"),
  }),
});

export type ValueActions = External<ReturnType<typeof valueActions>>;

type Props = {
  readonly value: unknown;
  readonly actions: ValueActions;
  readonly depth?: number;
  /** Names an object by a field that tells it from its siblings: an array's or a set's item. */
  readonly hinted?: boolean;
  /** Shows a collection's entries alone, under a key that folds it already. */
  readonly bare?: boolean;
  /** What a ref the value is shows before its label. */
  readonly refIcon?: string;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const label = (value: Readonly<Record<string, unknown>>): string =>
  String(value["label"]);

/** How deep a tree opens by itself. */
const OPEN = 2;

/** The fields that tell an item from its siblings, in the order one is picked. */
const NAMING = ["key", "id", "name", "label", "ref", "view"];

/** How long a hint's value shows, in characters. */
const HINT = 60;

/** What tells an object from its siblings: a field naming it, as one line; `null` if none. */
function hintOf(value: Readonly<Record<string, unknown>>): string | null {
  for (const field of NAMING) {
    if (!(field in value)) continue;
    const named = value[field];
    const text =
      typeof named === "string"
        ? named
        : typeof named === "number"
        ? String(named)
        : isRecord(named) && "label" in named
        ? label(named)
        : null;
    if (text === null) continue;
    return `${field} ${text.length > HINT ? `${text.slice(0, HINT)}…` : text}`;
  }
  return null;
}

function Inputs({
  inputs,
}: {
  readonly inputs: readonly InputInfo[];
}): ReactNode {
  return inputs.map((info) => (
    <input
      key={info.name}
      name={info.name}
      aria-label={info.name}
      placeholder={
        "default" in info
          ? `${info.name} = ${JSON.stringify(info.default)}`
          : info.name
      }
    />
  ));
}

function Marker({
  value,
  actions,
  refIcon,
}: {
  readonly value: Readonly<Record<string, unknown>>;
  readonly actions: ValueActions;
  readonly refIcon: string;
}): ReactNode {
  const handler = useHandler();
  if ("$ref" in value) {
    const handle = value["$ref"];
    if (typeof handle !== "number") {
      return (
        <span className="dt-ref">
          {refIcon} <Label text={label(value)} single />
        </span>
      );
    }
    return (
      <button
        type="button"
        className="dt-ref"
        onClick={handler(actions.follow, { handle, title: label(value) })}
      >
        {refIcon} <Label text={label(value)} single />
      </button>
    );
  }
  if ("$open" in value && isRecord(value["$open"])) {
    const { side, view, args } = value["$open"];
    return (
      <button
        type="button"
        className="dt-ref"
        title={`Open in ${String(side)}`}
        onClick={handler(actions.open, {
          side: String(side),
          view: String(view),
          args,
          title: label(value),
        })}
      >
        ⇢ <Label text={label(value)} single />
      </button>
    );
  }
  if ("$action" in value) {
    const handle = value["$action"];
    const inputs = (value["inputs"] ?? []) as readonly InputInfo[];
    if (typeof handle !== "number") {
      return (
        <span className="dt-action">
          ! <Label text={label(value)} single />
        </span>
      );
    }
    return (
      <form
        className="dt-action"
        onSubmit={handler(actions.run, { handle, title: label(value) })}
      >
        <button type="submit">
          ! <Label text={label(value)} single />
        </button>
        <Inputs inputs={inputs} />
      </form>
    );
  }
  if ("$input" in value)
    return <span className="dt-input">${String(value["$input"])}</span>;
  if ("$fn" in value)
    return <span className="dt-meta">ƒ {String(value["$fn"])}</span>;
  if ("$date" in value)
    return <span className="dt-meta">{String(value["$date"])}</span>;
  if ("$error" in value)
    return <span className="dt-failed">{String(value["$error"])}</span>;
  if ("$object" in value)
    return (
      <span className="dt-meta">
        {String(value["$object"])} {"{…}"}
      </span>
    );
  if ("$cut" in value) return <span className="dt-meta">…</span>;
  return null;
}

/** The keys `describe` marks a value by. */
const MARKERS = [
  "$ref",
  "$open",
  "$action",
  "$input",
  "$fn",
  "$date",
  "$error",
  "$object",
  "$cut",
];

/** A value that opens to entries: their summary, and what tells it from its siblings. */
type Collection = {
  readonly summary: string;
  readonly entries: readonly (readonly [ReactNode, unknown])[];
  /** Its items' hints, for an array's or a set's. */
  readonly hinted: boolean;
  readonly hint: string | null;
};

/** The entries `value` opens to; `null` for a leaf or a marker. */
function collectionOf(
  value: unknown,
  actions: ValueActions,
  hinted: boolean,
): Collection | null {
  if (Array.isArray(value)) {
    const items: readonly unknown[] = value;
    return {
      summary: `Array(${items.length})`,
      entries: items.map((item, index) => [`${index}:`, item] as const),
      hinted: true,
      hint: null,
    };
  }
  if (!isRecord(value)) return null;
  if ("$map" in value && Array.isArray(value["$map"])) {
    const pairs: readonly (readonly [unknown, unknown])[] = value["$map"];
    return {
      summary: `Map(${pairs.length})`,
      entries: pairs.map(
        ([key, item]) =>
          [
            <>
              <Value value={key} actions={actions} depth={OPEN} /> →
            </>,
            item,
          ] as const,
      ),
      hinted: false,
      hint: null,
    };
  }
  if ("$set" in value && Array.isArray(value["$set"])) {
    const items: readonly unknown[] = value["$set"];
    return {
      summary: `Set(${items.length})`,
      entries: items.map((item) => ["•", item] as const),
      hinted: true,
      hint: null,
    };
  }
  if (MARKERS.some((key) => key in value)) return null;
  const keys = Object.keys(value);
  return {
    summary: `{${keys.length}}`,
    entries: keys.map((key) => [`${key}:`, value[key]] as const),
    hinted: false,
    hint: hinted ? hintOf(value) : null,
  };
}

function Head({ collection }: { readonly collection: Collection }): ReactNode {
  return (
    <span className="dt-meta">
      {collection.summary}
      {collection.hint !== null && (
        <span className="dt-hint"> {collection.hint}</span>
      )}
    </span>
  );
}

/** A collection's entries: one that opens folds at its key, its entries below it. */
function Entries({
  collection,
  actions,
  depth,
}: {
  readonly collection: Collection;
  readonly actions: ValueActions;
  readonly depth: number;
}): ReactNode {
  return (
    <ul>
      {collection.entries.map(([key, item], index) => {
        const nested = collectionOf(item, actions, collection.hinted);
        if (nested === null || nested.entries.length === 0) {
          return (
            <li key={index}>
              <span className="dt-key">{key}</span>{" "}
              {nested === null ? (
                <Value value={item} actions={actions} depth={depth + 1} />
              ) : (
                <Head collection={nested} />
              )}
            </li>
          );
        }
        return (
          <li key={index} className="dt-branch">
            <details open={depth + 1 < OPEN}>
              <summary>
                <span className="dt-key">{key}</span>{" "}
                <Head collection={nested} />
              </summary>
              <Entries
                collection={nested}
                actions={actions}
                depth={depth + 1}
              />
            </details>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A value as a tree. `bare` shows a collection's entries without its own summary, for a
 * value under a key that already folds it.
 */
export function Value({
  value,
  actions,
  depth = 0,
  hinted = false,
  bare = false,
  refIcon = "→",
}: Props): ReactNode {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return <span className="dt-literal">{String(value)}</span>;
  }
  if (typeof value === "string")
    return <span className="dt-string">{JSON.stringify(value)}</span>;
  if (isRecord(value) && MARKERS.some((key) => key in value)) {
    return <Marker value={value} actions={actions} refIcon={refIcon} />;
  }
  const collection = collectionOf(value, actions, hinted);
  if (collection === null) {
    return (
      <span className="dt-meta">{JSON.stringify(value) ?? typeof value}</span>
    );
  }
  if (collection.entries.length === 0) return <Head collection={collection} />;
  if (bare) {
    return (
      <div className="dt-tree dt-bare">
        <Entries collection={collection} actions={actions} depth={depth} />
      </div>
    );
  }
  return (
    <details className="dt-tree" open={depth < OPEN}>
      <summary className={collection.hint === null ? undefined : "dt-hinted"}>
        <Head collection={collection} />
      </summary>
      <Entries collection={collection} actions={actions} depth={depth} />
    </details>
  );
}
