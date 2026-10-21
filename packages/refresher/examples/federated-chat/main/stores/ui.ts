import { storeView } from "../../../../src/index";
import type {
  ChangeFeed,
  StoreChangeListener,
  StoreViewContext,
} from "../../../../src/index";
import type { WritableStore } from "../../lib/actions";
import type { PageBeforeArgs } from "../../worker/views/messages";
import type { ChatsRef, PageRef, RoomRef } from "./worker";

/** An older page of the selected room: its query's args, and its root once open. */
export type OlderPage = {
  readonly args: PageBeforeArgs;
  readonly ref: PageRef;
};

/** A message sent but not yet confirmed: the optimistic overlay renders it until it lands. */
export type PendingMessage = {
  /** The id the worker stores it under, so its confirmed row can replace it. */
  readonly id: string;
  readonly chatId: string;
  readonly text: string;
  readonly sentAt: number;
};

/**
 * A like or unlike not yet confirmed: the likes show it, ignoring the worker's answers until
 * the latest run of it settles, then until an answer shows it too.
 */
export type PendingLike = {
  readonly messageId: string;
  /** Whether You like it once the worker runs the latest request. */
  readonly liked: boolean;
  /** Counts the requests: only the latest one's run settles it. */
  readonly run: number;
  /** Whether the latest run settled: the worker's next answer that shows it ends it. */
  readonly settled: boolean;
};

/**
 * Main-thread application state. It never crosses to the worker, but holds the roots of the
 * worker's queries actions opened: views read the worker's instances by them.
 */
export type UiState = {
  /** The sidebar's query, once open. */
  readonly chatsRef: ChatsRef | null;
  /** Whether `bootApp` has yet to open the worker's first queries. */
  readonly booting: boolean;
  /** The chat on screen, and its room's query, open while it is on screen. */
  readonly selected: string | null;
  readonly room: RoomRef | null;
  /** The selected room's older pages found so far, newest first; the room's query brings the latest. */
  readonly pages: readonly OlderPage[];
  /** How many of the room's pages, newest first, the list hides behind its "newer" button. */
  readonly skip: number;
  /** The chat being navigated to, until its room's first answer arrives. */
  readonly navigating: string | null;
  readonly menu: boolean;
  readonly compact: boolean;
  readonly pending: readonly PendingMessage[];
  readonly liking: readonly PendingLike[];
};

/** The UI store's state, as its store views read it. */
export type UiHandle = ChangeFeed & {
  get<K extends keyof UiState>(key: K): UiState[K];
  set(patch: Partial<UiState>): void;
};

const FIELDS = [
  "chatsRef",
  "booting",
  "selected",
  "room",
  "pages",
  "skip",
  "navigating",
  "menu",
  "compact",
  "pending",
  "liking",
] as const satisfies readonly (keyof UiState)[];

/** Synchronous: every write is announced before `set` returns. */
export function createUiHandle(initial: UiState): UiHandle {
  let state = initial;
  const listeners = new Set<StoreChangeListener>();
  let revision = 0;
  return {
    get: (key) => state[key],
    set(patch) {
      const keys = FIELDS.filter(
        (key) => patch[key] !== undefined && patch[key] !== state[key],
      );
      if (keys.length === 0) return;
      state = { ...state, ...patch };
      // One delivery: a patch touching several keys is one atomic change.
      const changes = keys.map((key) => ({
        store: "ui",
        operation: "set",
        value: key,
      }));
      revision++;
      for (const listener of listeners) listener(changes, revision);
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

/** The UI store's write surface, as actions open it with `store(ui)`. */
export type UiWriter = {
  set(patch: Partial<Omit<UiState, "pending" | "liking">>): void;
  /** Shows a message as pending until the worker's row replaces it. */
  addPending(message: PendingMessage): void;
  dropPending(id: string): void;
  /** Shows a message as liked or not until the worker's answer does: answers the request's run. */
  requestLike(messageId: string, liked: boolean): number;
  /**
   * Settles the request `run`, if no later one replaced it: ends it if the worker's answer
   * already shows it, `shown`, or else waits for one that does.
   */
  settleLike(messageId: string, run: number, shown: boolean): void;
  /** Ends the request `run` that failed, if no later one replaced it. */
  failLike(messageId: string, run: number): void;
};

const withoutLike = (liking: readonly PendingLike[], messageId: string) =>
  liking.filter((like) => like.messageId !== messageId);

/** Writes `handle`, whose feed restarts the queries the write reaches. */
export function createUiWriter(handle: UiHandle): UiWriter {
  return {
    set: (patch) => handle.set(patch),
    addPending: (message) =>
      handle.set({ pending: [...handle.get("pending"), message] }),
    dropPending: (id) =>
      handle.set({
        pending: handle.get("pending").filter((sent) => sent.id !== id),
      }),
    requestLike(messageId, liked) {
      const liking = handle.get("liking");
      const run =
        (liking.find((like) => like.messageId === messageId)?.run ?? 0) + 1;
      const like = { messageId, liked, run, settled: false };
      handle.set({ liking: [...withoutLike(liking, messageId), like] });
      return run;
    },
    settleLike(messageId, run, shown) {
      const liking = handle.get("liking");
      const like = liking.find((pending) => pending.messageId === messageId);
      if (like?.run !== run) return;
      const rest = withoutLike(liking, messageId);
      handle.set({
        liking: shown ? rest : [...rest, { ...like, settled: true }],
      });
    },
    failLike(messageId, run) {
      const liking = handle.get("liking");
      if (liking.find((like) => like.messageId === messageId)?.run === run)
        handle.set({ liking: withoutLike(liking, messageId) });
    },
  };
}

/** One key of the UI store: a view that reads it runs again only when that key changes. */
const field = <K extends keyof UiState>(key: K) =>
  // Named in full: inference cannot see through a key not yet chosen.
  storeView<
    undefined,
    UiState[K],
    UiHandle,
    Record<string, never>,
    UiState[K],
    unknown
  >({
    store: "ui",
    name: `ui ${key}`,
    resolve: (_args, { store }) => store.get(key),
    matches: (_args, change) => change.value === key,
  });

const views = {
  chatsRef: field("chatsRef"),
  booting: field("booting"),
  selected: field("selected"),
  room: field("room"),
  pages: field("pages"),
  skip: field("skip"),
  navigating: field("navigating"),
  menu: field("menu"),
  compact: field("compact"),
  /** The ids of a chat's pending messages, oldest first. */
  pending: storeView({
    store: "ui",
    name: "ui pending",
    resolve: (
      chatId: string,
      { store }: StoreViewContext<UiHandle>,
    ): readonly string[] =>
      store
        .get("pending")
        .filter((sent) => sent.chatId === chatId)
        .map((sent) => sent.id),
    matches: (_chatId, change) => change.value === "pending",
  }),
  /** A pending message, or `null` once it is no longer pending. */
  pendingMessage: storeView({
    store: "ui",
    name: "ui pendingMessage",
    resolve: (
      id: string,
      { store }: StoreViewContext<UiHandle>,
    ): PendingMessage | null =>
      store.get("pending").find((sent) => sent.id === id) ?? null,
    matches: (_id, change) => change.value === "pending",
  }),
  /** Whether You like a message until the worker confirms it, `null` if nothing is pending. */
  liking: storeView({
    store: "ui",
    name: "ui liking",
    resolve: (
      messageId: string,
      { store }: StoreViewContext<UiHandle>,
    ): boolean | null =>
      store.get("liking").find((like) => like.messageId === messageId)?.liked ??
      null,
    matches: (_messageId, change) => change.value === "liking",
  }),
  /** Every key and its value: for tools that list them. */
  entries: storeView({
    store: "ui",
    name: "ui entries",
    resolve: (_args: undefined, { store }: StoreViewContext<UiHandle>) =>
      FIELDS.map((key) => ({ key, value: store.get(key) })),
    matches: () => true,
  }),
};

/** Whether `key` names a key of the UI store. */
export const isUiKey = (key: unknown): key is keyof UiState =>
  FIELDS.some((name) => name === key);

/** The UI store: its views, read as `ui.menu`, and its writer, opened by actions as `store(ui)`. */
export const ui: WritableStore<UiWriter> & typeof views = {
  name: "ui",
  ...views,
};
