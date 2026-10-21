/**
 * The devtools: a Refresher application of their own, beside the one they inspect. Each
 * inspected runtime is a side, reached over a link to its inspector; traced events arrive
 * from the main thread by `trace`, and from the worker over its link.
 */
import { createRoot } from "react-dom/client";
import {
  createMainThreadEnvironment,
  createRuntime,
} from "../../../../src/index";
import { createRunner, storeWriter } from "../actions";
import { createSimpleDriver } from "../driver";
import { DataBoundary, DataProvider, createClient } from "../react";
import { Devtools, devtoolsView } from "./Devtools";
import type { InspectorLink, TraceEvent } from "./protocol";
import { createDevtoolsHandle, devtools } from "./state";
import type { DevtoolsServices } from "./state";
import type { Trace } from "./trace";

export type DevtoolsApp = {
  /** Logs an event: events a task traces are logged together, once it is done. */
  readonly trace: Trace;
  /** The milliseconds the activity tab set to delay every message from the worker by. */
  readonly latency: () => number;
  /** Inspects a runtime, as `side`, over `link`. */
  connect(side: string, link: InspectorLink): void;
  /**
   * Renders into `element` while open, with a handle on its left edge to resize it, and a
   * button in the page's corner to open and close it: closed at first.
   */
  mount(element: HTMLElement): void;
};

/** How often the devtools' runtime lets go of changes. */
const TRIM_EVERY = 10_000;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Where the width the panel was dragged to is kept, across reloads. */
const WIDTH_KEY = "devtools.width";
/** The narrowest either the panel or the page beside it gets. */
const MIN_WIDTH = 320;

/**
 * A handle on the panel's left edge: dragging it sets the page's `--devtools-width`, and a
 * double click goes back to the default.
 */
function resizable(panel: HTMLElement): void {
  const root = panel.ownerDocument.documentElement;
  const apply = (width: string | null): void => {
    if (width === null) root.style.removeProperty("--devtools-width");
    else root.style.setProperty("--devtools-width", width);
  };
  apply(localStorage.getItem(WIDTH_KEY));
  const grip = document.createElement("div");
  grip.className = "devtools-grip";
  grip.title = "Drag to resize, double-click to reset";
  grip.addEventListener("pointerdown", (down) => {
    down.preventDefault();
    grip.setPointerCapture(down.pointerId);
    const right = panel.getBoundingClientRect().right;
    const drag = (move: PointerEvent): void => {
      const most = right - MIN_WIDTH;
      const width = Math.max(MIN_WIDTH, Math.min(most, right - move.clientX));
      apply(`${Math.round(width)}px`);
    };
    const drop = (): void => {
      grip.removeEventListener("pointermove", drag);
      const width = root.style.getPropertyValue("--devtools-width");
      if (width !== "") localStorage.setItem(WIDTH_KEY, width);
    };
    grip.addEventListener("pointermove", drag);
    grip.addEventListener("lostpointercapture", drop, { once: true });
  });
  grip.addEventListener("dblclick", () => {
    localStorage.removeItem(WIDTH_KEY);
    apply(null);
  });
  panel.append(grip);
}

/** Where whether the panel is open is kept, across reloads. */
const OPEN_KEY = "devtools.open";

/**
 * A button in the page's corner opening and closing the panel: the page shows it, by
 * `devtools-open` on its root, while `render` mounts it and stops rendering it once closed.
 */
function toggleable(
  panel: HTMLElement,
  render: (into: HTMLElement) => () => void,
): void {
  const document = panel.ownerDocument;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "devtools-toggle";
  button.setAttribute("aria-controls", panel.id);
  let unmount: (() => void) | undefined;
  const show = (open: boolean): void => {
    document.documentElement.classList.toggle("devtools-open", open);
    button.textContent = open ? "Close devtools" : "Devtools";
    button.setAttribute("aria-expanded", String(open));
    if (open) unmount ??= render(panel);
    else {
      unmount?.();
      unmount = undefined;
    }
  };
  button.addEventListener("click", () => {
    const open = unmount === undefined;
    localStorage.setItem(OPEN_KEY, String(open));
    show(open);
  });
  document.body.append(button);
  show(localStorage.getItem(OPEN_KEY) === "true");
}

export function createDevtools(): DevtoolsApp {
  const handle = createDevtoolsHandle();
  const links = new Map<string, InspectorLink>();
  /** The edits not answered yet, by key. */
  const editing = new Map<
    string,
    { resolve(): void; reject(error: Error): void }
  >();
  let keys = 0;
  let traced: TraceEvent[] | undefined;

  const trace: Trace = (event) => {
    if (traced === undefined) {
      traced = [];
      // Logged in one write: the activity tab renders once for all a task traced.
      queueMicrotask(() => {
        const logged = traced ?? [];
        traced = undefined;
        handle.log(logged);
      });
    }
    traced.push(event);
  };

  const runtime = createRuntime({
    env: createMainThreadEnvironment(),
    feed: handle,
    store: () => handle,
  });
  let trimmed = runtime.latestRevision();
  setInterval(() => {
    runtime.trim(trimmed);
    trimmed = runtime.latestRevision();
  }, TRIM_EVERY);

  const client = createClient({
    runtime,
    driver: createSimpleDriver(["render"]),
  });

  const send: DevtoolsServices["send"] = (side, message) => {
    const link = links.get(side);
    if (link === undefined)
      throw new Error(`No runtime is inspected as ${side}`);
    link.send(message);
  };
  const key = (): string => `devtools-${++keys}`;

  const run = createRunner<DevtoolsServices>({
    client,
    writers: [storeWriter(devtools, handle)],
    services: {
      send,
      key,
      edit: (side, edit) =>
        new Promise((resolve, reject) => {
          const edited = key();
          editing.set(edited, { resolve, reject });
          send(side, { type: "edit", key: edited, ...edit });
        }),
    },
    report: (error) => {
      console.error(error);
      handle.set({ error: messageOf(error) });
    },
  });

  return {
    trace,
    latency: () => handle.get("latency"),
    connect(side, link) {
      links.set(side, link);
      link.listen((message) => {
        if (message.type === "trace") return trace(message.event);
        if (message.type !== "listed") {
          const waiting = editing.get(message.key);
          if (waiting !== undefined) {
            editing.delete(message.key);
            if (message.type === "failed")
              waiting.reject(new Error(message.message));
            else waiting.resolve();
            return;
          }
        }
        handle.receive(side, message);
      });
      handle.set({ sides: [...handle.get("sides"), side] });
      link.send({ type: "list" });
    },
    mount(element) {
      resizable(element);
      toggleable(element, (panel) => {
        const container = document.createElement("div");
        container.className = "devtools-root";
        panel.append(container);
        const root = createRoot(container);
        root.render(
          <DataProvider client={client} run={run}>
            <DataBoundary
              fallback={<p className="dt-meta">Loading the devtools…</p>}
              failure={(error, retry) => (
                <p className="dt-failed" role="alert">
                  {error.message} <button onClick={retry}>Retry</button>
                </p>
              )}
            >
              <Devtools root={runtime.root(devtoolsView)} />
            </DataBoundary>
          </DataProvider>,
        );
        return () => {
          root.unmount();
          container.remove();
        };
      });
    },
  };
}
