import type { FormEvent, ReactNode } from "react";
import { view } from "../../../../src/index";
import type { ResultOf } from "../../../../src/index";
import { render, useData, useHandler } from "../react";
import type { DataRef } from "../react";
import { labelOf } from "./describe";
import { Label } from "./Label";
import type { Frame } from "./state";
import { devtools } from "./state";
import type { DevtoolsContext } from "./state";
import { Value, openFrame, parseField, valueActions } from "./Value";

/** Handles a view's submit: watches it, with the form's arguments, in a new frame. */
export function openView(
  {
    side,
    view: key,
    name,
  }: { readonly side: string; readonly view: string; readonly name: string },
  context: DevtoolsContext,
  event: FormEvent<HTMLFormElement>,
): void {
  event.preventDefault();
  const args = parseField(new FormData(event.currentTarget).get("args"));
  openFrame(context, side, labelOf(name, args), {
    kind: "view",
    view: key,
    args,
  });
}

export function closeFrame(
  { key, side, live }: Frame,
  { read, store, send }: DevtoolsContext,
): void {
  if (live) send(side, { type: "unwatch", key });
  store(devtools).forget(key);
  store(devtools).set({
    frames: read(devtools.frames).filter((frame) => frame.key !== key),
  });
}

/** Lists every side's views and stores again. */
export function relist(
  _args: undefined,
  { read, send }: DevtoolsContext,
): void {
  for (const side of read(devtools.sides)) send(side, { type: "list" });
}

/** A side's views, by name. */
export const viewListView = view({
  name: "View list",
  resolve: (side: string, { read, action }) => {
    const listed = read(devtools.listed, side);
    const all = listed?.views ?? [];
    const views = [...all].sort((a, b) => a.name.localeCompare(b.name));
    return {
      side,
      views: views.map((info) => ({
        key: info.key,
        name: info.name,
        about: [
          info.kind === "derived" ? null : info.kind,
          info.store,
          ...info.access,
        ]
          .filter((each) => each !== null)
          .join(" · "),
        open: action(openView, { side, view: info.key, name: info.name }),
      })),
    };
  },
});

/** A watch's latest result, or what a run answered. */
export const frameView = view({
  name: "Frame",
  resolve: (frame: Frame, context) => {
    const answer = context.read(devtools.answer, frame.key);
    return {
      title: frame.title,
      side: frame.side,
      live: frame.live,
      loading: answer === null,
      value: answer?.value ?? null,
      errors: answer?.errors ?? [],
      failed: answer?.failed ?? null,
      close: context.action(closeFrame, frame),
      actions: valueActions(frame.side, context),
    };
  },
});

export const viewsTabView = view({
  name: "Views tab",
  resolve: (_args: undefined, { read, ref, action }) => ({
    lists: read(devtools.sides).map((side) => ref(viewListView, side, render)),
    frames: read(devtools.frames).map((frame) => ref(frameView, frame, render)),
    relist: action(relist),
  }),
});

function ViewList({
  dataRef,
}: {
  readonly dataRef: DataRef<ResultOf<typeof viewListView>>;
}): ReactNode {
  const list = useData(dataRef);
  const handler = useHandler();
  return (
    <details className="dt-list" open>
      <summary>
        {list.side} <span className="dt-meta">({list.views.length})</span>
      </summary>
      <ul>
        {list.views.map((info) => (
          <li key={info.key}>
            <details>
              <summary>
                <Label text={info.name} single />{" "}
                <span className="dt-meta">{info.about}</span>
              </summary>
              <form onSubmit={handler(info.open)}>
                <textarea
                  name="args"
                  rows={2}
                  placeholder="Arguments, as JSON"
                  spellCheck={false}
                />
                <button type="submit">Run</button>
              </form>
            </details>
          </li>
        ))}
      </ul>
    </details>
  );
}

function FrameCard({
  dataRef,
}: {
  readonly dataRef: DataRef<ResultOf<typeof frameView>>;
}): ReactNode {
  const frame = useData(dataRef);
  const handler = useHandler();
  return (
    <article className="dt-frame">
      <header>
        <span className="dt-badge">{frame.side}</span>{" "}
        {frame.live && <span className="dt-badge dt-query">live</span>}{" "}
        <b>
          <Label text={frame.title} single />
        </b>
        <button type="button" aria-label="Close" onClick={handler(frame.close)}>
          ×
        </button>
      </header>
      {frame.loading && <p className="dt-meta">Running…</p>}
      {frame.failed !== null && <p className="dt-failed">{frame.failed}</p>}
      {frame.errors.map((error, index) => (
        <p key={index} className="dt-failed">
          {error}
        </p>
      ))}
      {!frame.loading && frame.failed === null && (
        <Value value={frame.value} actions={frame.actions} />
      )}
    </article>
  );
}

export function ViewsTab({
  dataRef,
}: {
  readonly dataRef: DataRef<ResultOf<typeof viewsTabView>>;
}): ReactNode {
  const tab = useData(dataRef);
  const handler = useHandler();
  return (
    <div className="dt-views">
      <nav>
        <button type="button" onClick={handler(tab.relist)}>
          Refresh lists
        </button>
        {tab.lists.map((list) => (
          <ViewList key={list} dataRef={list} />
        ))}
      </nav>
      <div className="dt-frames">
        {tab.frames.length === 0 && (
          <p className="dt-meta">
            Run a view, or follow a ref from a result or the activity tab.
          </p>
        )}
        {tab.frames.map((frame) => (
          <FrameCard key={frame} dataRef={frame} />
        ))}
      </div>
    </div>
  );
}
