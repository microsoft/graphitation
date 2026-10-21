import type { ExternalRefFor, ResultOf } from "../../../../src/index";
import { remoteStore } from "../../lib/remote";
import { ids } from "../../shared";
import type { chat, chatList } from "../../worker/views/chats";
import type { likes } from "../../worker/views/likes";
import type { message, page, pageBefore } from "../../worker/views/messages";
import type { profile } from "../../worker/views/profile";
import type { chatRoom, newestChatOnOpen } from "../../worker/views/room";

/** The worker's views, as the main thread reads them: through the remote queries actions open. */
export const worker = remoteStore("worker");

/** What the sidebar reads by the refs it takes: a chat's summary. */
export type SidebarFollowed = ResultOf<typeof chat>;

/**
 * What a page's query follows: the page its pin kept, its messages, their likes, and their
 * authors' and likers' profiles.
 */
export type PageFollowed = ResultOf<
  typeof page | typeof message | typeof likes | typeof profile
>;

/** What a room's query follows: its summary, its latest page, and all a page's query follows. */
export type RoomFollowed =
  | PageFollowed
  | ResultOf<typeof chat | typeof pageBefore>;

/** The sidebar's query: every chat's summary. `bootApp` opens it, for good. */
export const chatsQuery = worker.external<typeof chatList, SidebarFollowed>(
  ids.chats,
  ["sidebar"],
);

/** The root of the sidebar's query, as opening it answers. */
export type ChatsRef = ExternalRefFor<typeof chatList, SidebarFollowed>;

/** What the newest chat's query follows: the room it found, and all a room's query follows. */
export type NewestChatFollowed = RoomFollowed | ResultOf<typeof chatRoom>;

/**
 * The newest chat's query: its room, as a room's query brings it. `bootChat` opens it at
 * start, alongside the sidebar's, and the first selection closes it. Its root is a pin, so
 * the query stays on that chat when another becomes the newest.
 */
export const newestChatQuery = worker.external<
  typeof newestChatOnOpen,
  NewestChatFollowed
>(ids.newestChatOnOpen, ["room"]);

/** A room's query: its summary, messages, and authors' profiles. Navigating opens it. */
export const roomQuery = worker.external<typeof chatRoom, RoomFollowed>(
  ids.room,
  ["room"],
);

/** The root of a room's query, as opening it answers. */
export type RoomRef = ExternalRefFor<typeof chatRoom, RoomFollowed>;

/**
 * An older page's query: the page its root, a pin, found before the page after it, its
 * messages and authors' profiles. Showing older pages opens it; the latest page comes with
 * the room's query.
 */
export const pageQuery = worker.external<typeof pageBefore, PageFollowed>(
  ids.pageBefore,
  ["room"],
);

/** The root of a page's query, as opening it answers. */
export type PageRef = ExternalRefFor<typeof pageBefore, PageFollowed>;

/** The external ref to the worker's message `id`, as a room's answers hold it. */
export const messageRef = (id: string) =>
  worker.ref<typeof message>(ids.message, id);

/** The external ref to the likes of the worker's message `id`, as a room's answers hold them. */
export const likesRef = (id: string) => worker.ref<typeof likes>(ids.likes, id);
