import type { ReactNode } from "react";
import { view } from "../../../../src/index";
import type { Ref } from "../../../../src/index";
import { DataBoundary, render, useQuery } from "../../lib/react";
import type { AppContext } from "../worker";
import { chatsQuery, newestChatQuery, worker } from "../stores/worker";
import { ui } from "../stores/ui";
import { Room, roomView } from "./Room";
import type { RoomData } from "./Room";
import { Sidebar, sidebarView } from "./Sidebar";
import type { SidebarData } from "./Sidebar";

/**
 * Opens the worker's first queries in parallel, and shows the application once both answered,
 * or one failed: starting waits once.
 */
export async function bootApp(
  _args: undefined,
  context: AppContext,
): Promise<void> {
  try {
    await Promise.all([
      bootSidebar(undefined, context),
      bootChat(undefined, context),
    ]);
  } finally {
    context.store(ui).set({ booting: false });
  }
}

/** Opens the sidebar's query, for good: the sidebar reads the list by its root. */
export async function bootSidebar(
  _args: undefined,
  { store, queries }: AppContext,
): Promise<void> {
  const chatsRef = await queries.open(chatsQuery, undefined);
  store(ui).set({ chatsRef });
}

/**
 * Opens the newest chat's query and puts its room on screen. The selection holds the query
 * until the first selection closes it.
 */
export async function bootChat(
  _args: undefined,
  { read, store, queries }: AppContext,
): Promise<void> {
  const room = read(
    worker.views,
    await queries.open(newestChatQuery, undefined),
  );
  const newest = room === null ? null : read(worker.views, room);
  store(ui).set({ selected: newest?.id ?? null, room });
}

export type AppData = {
  readonly className: string;
  /** `null` until `bootApp` is done. */
  readonly sidebar: Ref<SidebarData> | null;
  readonly room: Ref<RoomData> | null;
};

/**
 * The application, from the UI store alone: the roots of the worker's queries actions opened,
 * and the chat on screen. It reads nothing remote, so it never waits.
 */
export const appView = view({
  name: "App",
  access: { queryable: true },
  resolve: (_args: undefined, { read, ref }): AppData => {
    const chats = read(ui.chatsRef);
    const selected = read(ui.selected);
    const room = read(ui.room);
    return {
      className: read(ui.compact) ? "chat compact" : "chat",
      sidebar:
        chats === null || read(ui.booting)
          ? null
          : ref(
              sidebarView,
              { chats, active: selected, navigating: read(ui.navigating) },
              render,
            ),
      room:
        selected === null || room === null
          ? null
          : ref(roomView, { chatId: selected, room }, render),
    };
  },
});

export function App({ root }: { readonly root: Ref<AppData> }): ReactNode {
  const app = useQuery(root);
  if (app.sidebar === null)
    return <p className="loading">Opening the chats…</p>;
  return (
    <div className={app.className}>
      <Sidebar dataRef={app.sidebar} />
      {app.room === null ? (
        <section className="room empty">No chats. Create one.</section>
      ) : (
        <DataBoundary
          key={app.room}
          fallback={<section className="room empty">Loading the chat…</section>}
          failure={(error, retry) => (
            <section className="room empty" role="alert">
              {error.message} <button onClick={retry}>Retry</button>
            </section>
          )}
        >
          <Room dataRef={app.room} />
        </DataBoundary>
      )}
    </div>
  );
}
