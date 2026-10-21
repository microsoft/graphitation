import type { ReactNode } from "react";
import { view } from "../../../../src/index";
import type {
  ActionRef,
  ExternalActionRef,
  ExternalRef,
} from "../../../../src/index";
import { useData, useHandler } from "../../lib/react";
import type { DataRef } from "../../lib/react";
import type { AppContext } from "../worker";
import { worker } from "../stores/worker";
import type { SidebarFollowed } from "../stores/worker";
import type * as workerActions from "../../worker/actions";
import type { ChatSummary } from "../../worker/views/chats";
import { ui } from "../stores/ui";
import { closeSelected, selectChat } from "./ChatLink";
import { shownPages } from "./MessageList";

export function toggleMenu(
  _args: undefined,
  { read, store }: AppContext,
): void {
  store(ui).set({ menu: !read(ui.menu) });
}

export function toggleCompact(
  _args: undefined,
  { read, store }: AppContext,
): void {
  store(ui).set({ compact: !read(ui.compact), menu: false });
}

/** Runs the worker's `create`, then answers with selecting the new chat, which the runner runs next. */
export async function createChat(
  {
    create,
  }: { readonly create: ExternalActionRef<typeof workerActions.createChat> },
  { store, run, action }: AppContext,
): Promise<ActionRef<typeof selectChat>> {
  store(ui).set({ menu: false });
  return action(selectChat, await run(create));
}

/**
 * Runs the worker's `delete`, the chat's, then navigates from it if it is still on screen:
 * to the newest other chat, or to none.
 */
export async function deleteChat(
  {
    chatId,
    remove,
  }: {
    readonly chatId: string;
    readonly remove: ExternalActionRef<typeof workerActions.deleteChat>;
  },
  { read, store, run, queries, action }: AppContext,
): Promise<ActionRef<typeof selectChat> | null> {
  store(ui).set({ menu: false });
  await run(remove);
  if (read(ui.selected) !== chatId) return null;
  const chats = read(ui.chatsRef);
  const next =
    chats === null
      ? undefined
      : read(worker.views, chats).entries.find((entry) => entry.id !== chatId);
  if (next !== undefined) return action(selectChat, next.id);
  const pages = shownPages(read(ui.pages), read(ui.skip));
  store(ui).set({ selected: null, room: null, pages: [], skip: 0 });
  closeSelected(chatId, pages, queries);
  return null;
}

export type MenuData = {
  readonly open: boolean;
  readonly compact: boolean;
  readonly toggleMenu: ActionRef<typeof toggleMenu>;
  readonly createChat: ActionRef<typeof createChat>;
  /** Offered only while a chat is active. */
  readonly deleteChat: ActionRef<typeof deleteChat> | null;
  /** The delete item's label, naming the active chat. */
  readonly deleteLabel: string;
  readonly toggleCompact: ActionRef<typeof toggleCompact>;
};

export const menuView = view({
  name: "Menu",
  /** Takes the worker's `create`, and the summary of the chat on screen, as the root's query followed it. */
  resolve: (
    {
      create,
      active,
    }: {
      readonly create: ExternalActionRef<typeof workerActions.createChat>;
      readonly active: ExternalRef<ChatSummary | null, SidebarFollowed> | null;
    },
    { read, action },
  ): MenuData => {
    const open = read(ui.menu);
    const compact = read(ui.compact);
    const chat = active === null ? null : read(worker.views, active);
    return {
      open,
      compact,
      toggleMenu: action(toggleMenu),
      createChat: action(createChat, { create }),
      deleteChat:
        chat === null
          ? null
          : action(deleteChat, { chatId: chat.id, remove: chat.delete }),
      deleteLabel: chat === null ? "Delete chat" : `Delete chat ${chat.title}`,
      toggleCompact: action(toggleCompact),
    };
  },
});

export function Menu({
  dataRef,
}: {
  readonly dataRef: DataRef<MenuData>;
}): ReactNode {
  const menu = useData(dataRef);
  const handler = useHandler();
  return (
    <div className="menu">
      <button
        type="button"
        aria-expanded={menu.open}
        onClick={handler(menu.toggleMenu)}
      >
        Menu
      </button>
      {menu.open && (
        <div role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={handler(menu.createChat)}
          >
            New chat
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={menu.deleteChat === null}
            onClick={handler(menu.deleteChat)}
          >
            {menu.deleteLabel}
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            aria-checked={menu.compact}
            onClick={handler(menu.toggleCompact)}
          >
            Compact rows
          </button>
        </div>
      )}
    </div>
  );
}
