import { createRoot } from "react-dom/client";
import { createMainThreadEnvironment, createRuntime } from "../../../src/index";
import { actions, createRunner, storeWriter } from "../lib/actions";
import { createHybridClock } from "../lib/clock";
import { encodedBy } from "../lib/devtools/describe";
import { createInspector, viewsIn } from "../lib/devtools/inspector";
import { createDevtools } from "../lib/devtools/mount";
import { localLink, portLink } from "../lib/devtools/protocol";
import { createTracer } from "../lib/devtools/trace";
import { createSimpleDriver } from "../lib/driver";
import { mergeFeeds } from "../lib/feeds";
import { DataBoundary, DataProvider, createClient } from "../lib/react";
import type { Init } from "../shared";
import type { LikesData } from "../worker/views/likes";
import { ids } from "../shared";
import * as AppModule from "./components/App";
import { App, appView, bootApp } from "./components/App";
import * as ChatLinkModule from "./components/ChatLink";
import * as ComposerModule from "./components/Composer";
import * as HeaderModule from "./components/Header";
import * as LikesModule from "./components/Likes";
import * as MenuModule from "./components/Menu";
import * as MessageListModule from "./components/MessageList";
import * as MessageRowModule from "./components/MessageRow";
import * as RoomModule from "./components/Room";
import * as RoomStatusModule from "./components/RoomStatus";
import * as SidebarModule from "./components/Sidebar";
import { likesRef, messageRef, worker as workerStore } from "./stores/worker";
import { createUiHandle, createUiWriter, isUiKey, ui } from "./stores/ui";
import { connectWorker } from "./worker";
import type { Services } from "./worker";
import "./styles.css";
import "../lib/devtools/devtools.css";

const devtools = createDevtools();
/** The worker's refs and action refs, as the main thread holds them, encoded. */
const encoded = encodedBy("worker", Object.values(ids));
/** Stamps the main thread's revisions: the worker's stamp theirs on a clock like it. */
const clock = createHybridClock();
const tracer = createTracer({
  side: "main",
  clock,
  trace: devtools.trace,
  options: { encoded },
});

const report = (error: unknown): void => {
  console.error(error);
  document.querySelector("#error")!.textContent =
    error instanceof Error ? error.message : String(error);
};

const uiHandle = createUiHandle({
  chatsRef: null,
  booting: true,
  selected: null,
  room: null,
  pages: [],
  skip: 0,
  navigating: null,
  menu: false,
  compact: false,
  pending: [],
  liking: [],
});

/**
 * Drops each pending message the worker's answers now hold, its confirmed row replaced it,
 * and each settled like they now show, or no longer hold.
 */
const prune = (): void => {
  const pending = uiHandle.get("pending");
  const kept = pending.filter((sent) => !connection.holds(messageRef(sent.id)));
  const liking = uiHandle.get("liking");
  const unconfirmed = liking.filter(({ messageId, liked, settled }) => {
    if (!settled) return true;
    const answer = connection.answer(likesRef(messageId));
    return answer !== undefined && (answer.value as LikesData).liked !== liked;
  });
  if (kept.length !== pending.length || unconfirmed.length !== liking.length)
    uiHandle.set({ pending: kept, liking: unconfirmed });
};

// Passes run in a microtask, so a write renders in the task that made it.
const env = createMainThreadEnvironment();

const thread = new Worker("/worker.js", { type: "module" });
const channel = new MessageChannel();
// The worker's inspector listens on a port of its own: the devtools are not its activity.
const inspecting = new MessageChannel();
const init: Init = { port: channel.port2, devtools: inspecting.port2 };
thread.postMessage(init, [channel.port2, inspecting.port2]);
const connection = connectWorker(channel.port1, {
  clock,
  tracer,
  afterReceive: prune,
  // The runtime exists by the time a query is closed.
  latestRevision: () => runtime.latestRevision(),
  latency: devtools.latency,
});

const runtime = createRuntime({
  env,
  feed: tracer.feed(mergeFeeds([uiHandle, connection.feed], clock)),
  store: (name) => (name === workerStore.name ? connection.handle : uiHandle),
});

/** How often the runtime lets go of changes, keeping one period behind for runs to subscribe in. */
const TRIM_EVERY = 10_000;
let trimmed = runtime.latestRevision();
setInterval(() => {
  runtime.trim(trimmed);
  trimmed = runtime.latestRevision();
}, TRIM_EVERY);

const client = createClient({
  // Traced: the devtools show each pass, and the queries it starts and restarts.
  runtime: tracer.runtime(runtime),
  driver: createSimpleDriver(["render"]),
  // Components receive the worker's refs too, and read them from its answers.
  remotes: [connection],
});

/** Every action runs on the main thread, but the worker's, which its views offer: `remote` sends those back. */
const run = createRunner<Services>({
  client,
  writers: [storeWriter(ui, createUiWriter(uiHandle))],
  services: { queries: connection },
  remote: (ref, inputs) => connection.run(ref, inputs),
  report,
  scope: tracer.scope,
});

devtools.connect(
  "main",
  localLink((send) =>
    createInspector({
      runtime,
      views: viewsIn(
        AppModule,
        ChatLinkModule,
        ComposerModule,
        HeaderModule,
        LikesModule,
        MenuModule,
        MessageListModule,
        MessageRowModule,
        RoomModule,
        RoomStatusModule,
        SidebarModule,
        ui,
        workerStore,
      ),
      stores: [
        {
          name: "ui",
          entries: ui.entries,
          put(key, value) {
            if (!isUiKey(key))
              throw new Error(`The UI store has no ${String(key)}`);
            // Whatever the devtools put: watch what breaks.
            uiHandle.set({ [key]: value });
          },
        },
        { name: workerStore.name, entries: workerStore.entries },
      ],
      run(ref, inputs) {
        // A string is the worker's: it runs there.
        if (typeof ref === "string")
          return connection.run(ref as never, inputs);
        run(ref as never, inputs as never);
        return Promise.resolve(undefined);
      },
      encoded,
      send,
    }),
  ),
);
devtools.connect("worker", portLink(inspecting.port1));
devtools.mount(document.querySelector<HTMLElement>("#devtools")!);

// Starting is an action too: it opens the worker's first queries.
run(actions(runtime)(bootApp));

createRoot(document.querySelector("#root")!).render(
  <DataProvider client={client} run={run}>
    <DataBoundary
      fallback={<p className="loading">Loading the whole tree in one batch…</p>}
      failure={(error, retry) => (
        <p role="alert">
          {error.message} <button onClick={retry}>Retry</button>
        </p>
      )}
    >
      <App root={runtime.root(appView)} />
    </DataBoundary>
  </DataProvider>,
);
