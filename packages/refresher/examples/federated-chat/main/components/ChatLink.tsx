import type { ReactNode } from "react";
import { view } from "../../../../src/index";
import type { ActionRef, ExternalRef } from "../../../../src/index";
import { useData, useHandler } from "../../lib/react";
import type { DataRef } from "../../lib/react";
import type { ChatSummary } from "../../worker/views/chats";
import type { AppContext } from "../worker";
import {
  newestChatQuery,
  pageQuery,
  roomQuery,
  worker,
} from "../stores/worker";
import { ui } from "../stores/ui";
import type { OlderPage } from "../stores/ui";
import type { SidebarFollowed } from "../stores/worker";
import { shownPages } from "./MessageList";

/** How long hovering a chat keeps its room's query open, in milliseconds. */
const PREVIEW_GRACE = 10_000;

/**
 * Closes the queries that held the chat on screen: its room's, at first the newest chat's,
 * and those of the older `pages` on screen.
 */
export function closeSelected(
  chatId: string,
  pages: readonly OlderPage[],
  queries: AppContext["queries"],
): void {
  queries.close(roomQuery, chatId);
  queries.close(newestChatQuery, undefined);
  for (const page of pages) queries.close(pageQuery, page.args);
}

/**
 * Navigates at once to a room the worker store still holds, reopening its query. Otherwise
 * opens it and navigates once it answered: until then the room on screen stays, and the
 * chat shows as pending. Closes the room it leaves, and the one it opened if another
 * navigation started meanwhile.
 */
export async function selectChat(
  chatId: string,
  { read, store, queries }: AppContext,
): Promise<void> {
  if (read(ui.selected) === chatId) return;
  let room = queries.reopen(roomQuery, chatId);
  if (room === undefined) {
    store(ui).set({ navigating: chatId });
    try {
      room = await queries.open(roomQuery, chatId);
    } catch (error) {
      if (read(ui.navigating) === chatId) store(ui).set({ navigating: null });
      throw error;
    }
    if (read(ui.navigating) !== chatId) return queries.close(roomQuery, chatId);
  }
  const left = read(ui.selected);
  const pages = shownPages(read(ui.pages), read(ui.skip));
  store(ui).set({
    selected: chatId,
    room,
    navigating: null,
    pages: [],
    skip: 0,
  });
  if (left !== null) closeSelected(left, pages, queries);
}

/** Opens the chat's room for a while, so selecting it navigates without waiting. */
export async function previewRoom(
  chatId: string,
  { read, queries }: AppContext,
): Promise<void> {
  if (read(ui.selected) === chatId) return;
  await queries.open(roomQuery, chatId);
  setTimeout(() => queries.close(roomQuery, chatId), PREVIEW_GRACE);
}

export type ChatLinkData = {
  readonly title: string;
  /** Its last message, or a placeholder. */
  readonly preview: string;
  readonly active: boolean;
  /** Whether navigating to it waits for its room's first answer. */
  readonly navigating: boolean;
  /** Offered only while the chat is not the active one. */
  readonly select: ActionRef<typeof selectChat> | null;
  readonly preload: ActionRef<typeof previewRoom>;
} | null;

export const chatLinkView = view({
  name: "ChatLink",
  resolve: (
    {
      summary,
      active,
      navigating,
    }: {
      readonly summary: ExternalRef<ChatSummary | null, SidebarFollowed>;
      readonly active: boolean;
      readonly navigating: boolean;
    },
    { read, action },
  ): ChatLinkData => {
    const chat = read(worker.views, summary);
    if (chat === null) return null;
    return {
      title: chat.title,
      preview: chat.preview ?? "No messages yet",
      active,
      navigating,
      select: active ? null : action(selectChat, chat.id),
      preload: action(previewRoom, chat.id),
    };
  },
});

export function ChatLink({
  dataRef,
}: {
  readonly dataRef: DataRef<ChatLinkData>;
}): ReactNode {
  const link = useData(dataRef);
  const handler = useHandler();
  if (link === null) return null;
  return (
    <button
      type="button"
      className="chat-link"
      aria-current={link.active}
      aria-busy={link.navigating}
      onClick={handler(link.select)}
      // Preloading on hover is off for now: it adds noise to the devtools' activity.
      // onPointerEnter={handler(link.preload)}
      // onFocus={handler(link.preload)}
    >
      <strong>{link.title}</strong>
      <small>{link.preview}</small>
    </button>
  );
}
