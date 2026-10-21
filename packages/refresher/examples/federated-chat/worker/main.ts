import { createRuntime, defaultEnvironment, view } from "../../../src/index";
import type { AnyActionRef, QueryableView, ViewId } from "../../../src/index";
import { createHybridClock } from "../lib/clock";
import { createInspector, viewsIn } from "../lib/devtools/inspector";
import type { InspectedStore } from "../lib/devtools/inspector";
import { servePort } from "../lib/devtools/protocol";
import {
  createTracer,
  failedFromHost,
  summarizeFromHost,
  summarizeToHost,
} from "../lib/devtools/trace";
import type { Trace } from "../lib/devtools/trace";
import type { TraceEvent } from "../lib/devtools/protocol";
import { serve } from "../lib/host";
import type { IdbKey, IdbRead, IdbWrites } from "../lib/idb/store";
import type { FromHost, ToHost } from "../lib/protocol";
import type { Init } from "../shared";
import { actionIds, ids } from "../shared";
import {
  createChat,
  deleteChat,
  likeMessage,
  sendMessage,
  sendReply,
} from "./actions";
import type { WorkerAction, WorkerContext } from "./actions";
import { openChatDatabase } from "./db/database";
import type { ChatDatabase, Writes } from "./db/database";
import { chats } from "./stores/chats";
import { likes } from "./stores/likes";
import { messages } from "./stores/messages";
import * as chatsModule from "./views/chats";
import * as likesModule from "./views/likes";
import { chatList } from "./views/chats";
import * as messagesModule from "./views/messages";
import { pageBefore } from "./views/messages";
import * as profileModule from "./views/profile";
import * as roomModule from "./views/room";
import { chatRoom, newestChatOnOpen } from "./views/room";

const replies = [
  "Noted. That write went to IndexedDB, then back to you as a pushed answer.",
  "The main thread never asked for this message: the worker pushed it.",
  "Try selecting another chat while I type.",
];

/** How often the runtime lets go of changes, keeping one period behind for runs to subscribe in. */
const TRIM_EVERY = 10_000;

/** An IndexedDB store as the devtools show it: every record, by its primary key, and its writes. */
function inspectedIdb<T>(
  database: ChatDatabase,
  store: {
    readonly name: string;
    readonly all: IdbRead<undefined, readonly T[]>;
    readonly keyOf: (record: T) => IdbKey;
  },
  writes: (all: Writes) => IdbWrites<T, string>,
): InspectedStore {
  const entries = view({
    name: `${store.name} entries`,
    access: { queryable: true },
    resolve: async (_args: undefined, { read }) =>
      (await read(store.all)).map((record) => ({
        key: store.keyOf(record as T),
        value: record,
      })),
  });
  return {
    name: store.name,
    entries,
    put: (_key, value) => database.write((all) => writes(all).put(value as T)),
    add: (value) => database.write((all) => writes(all).put(value as T)),
    delete: (key) => database.write((all) => writes(all).delete(key as IdbKey)),
  };
}

/**
 * The worker owns IndexedDB and runs the data graph. The main thread reaches it only
 * through remote queries, and the action refs their answers offer, over this port. The
 * devtools inspect it over `inspecting`.
 */
async function start(
  port: MessagePort,
  inspecting: MessagePort,
): Promise<void> {
  // Kept until the inspector is, which sends them to the devtools.
  const early: TraceEvent[] = [];
  let trace: Trace = (event) => void early.push(event);
  /** Stamps the worker's revisions: the main thread's stamp theirs on a clock like it. */
  const clock = createHybridClock();
  const tracer = createTracer({
    side: "worker",
    clock,
    trace: (event) => trace(event),
  });
  const post = (message: FromHost): void => {
    tracer.wire(
      "main",
      "out",
      summarizeFromHost(message),
      message,
      failedFromHost(message),
    );
    port.postMessage(message);
  };
  const database = await openChatDatabase(clock);
  const runtime = createRuntime({
    env: defaultEnvironment,
    feed: tracer.feed(database),
    store: database.store,
  });
  const published = new Map<ViewId, QueryableView>([
    [ids.chats, chatList],
    [ids.newestChatOnOpen, newestChatOnOpen],
    [ids.room, chatRoom],
    [ids.pageBefore, pageBefore],
  ]);
  const actions = new Map<string, WorkerAction>([
    [actionIds.send, sendMessage],
    [actionIds.create, createChat],
    [actionIds.delete, deleteChat],
    [actionIds.like, likeMessage],
  ]);

  let trimmed = runtime.latestRevision();
  setInterval(() => {
    runtime.trim(trimmed);
    trimmed = runtime.latestRevision();
  }, TRIM_EVERY);

  let replyCount = 0;
  const context: WorkerContext = {
    database,
    reply(chatId) {
      const text = replies[replyCount++ % replies.length]!;
      context.later(sendReply, { chatId, text });
    },
    later(action, args) {
      setTimeout(
        () =>
          void tracer
            .call(action.name, args, () => action(args, context))
            .catch(console.error),
        1200,
      );
    },
  };
  const send = servePort(inspecting, (answer) =>
    createInspector({
      runtime,
      views: viewsIn(
        chatsModule,
        messagesModule,
        likesModule,
        profileModule,
        roomModule,
        chats,
        messages,
        likes,
      ),
      stores: [
        inspectedIdb(database, chats, (all) => all.chats),
        inspectedIdb(database, messages, (all) => all.messages),
        inspectedIdb(database, likes, (all) => all.likes),
      ],
      run(ref, inputs) {
        if (typeof ref === "string") {
          return Promise.reject(
            new Error("The worker runs only its own action refs"),
          );
        }
        const bound: AnyActionRef = runtime.bind(ref, inputs);
        const action = bound.action as WorkerAction;
        return tracer.call(action.name, bound.args, () =>
          Promise.resolve(action(bound.args as never, context)),
        );
      },
      send: answer,
    }),
  );
  trace = (event) => send({ type: "trace", event });
  for (const event of early.splice(0)) trace(event);

  const host = serve({
    // Traced: the devtools show each pass, and the queries it starts and restarts.
    runtime: tracer.runtime(runtime),
    published,
    actions,
    run: (action, args) =>
      tracer.call(action.name, args, () => action(args as never, context)),
    send: post,
  });

  port.addEventListener("message", (event: MessageEvent<ToHost>) => {
    const message = event.data;
    clock.observe(message.revision);
    tracer.wire("main", "in", summarizeToHost(message), message, false);
    host.receive(message);
  });
  port.start();
}

globalThis.addEventListener(
  "message",
  (event: MessageEvent<Init>) => {
    void start(event.data.port, event.data.devtools).catch(console.error);
  },
  { once: true },
);
