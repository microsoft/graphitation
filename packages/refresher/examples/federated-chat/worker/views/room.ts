import { pin, view } from "../../../../src/index";
import type { ActionRef, Ref } from "../../../../src/index";
import { ids } from "../../shared";
import type { ChatRecord } from "../../shared";
import { sendMessage } from "../actions";
import { chats } from "../stores/chats";
import { chat } from "./chats";
import type { ChatSummary } from "./chats";
import { pageBefore } from "./messages";
import type { PageArgs, PageData } from "./messages";
import { room } from "./tags";

export type RoomData = {
  readonly id: string;
  readonly summary: Ref<ChatSummary | null>;
  /** The latest page, as of opening the room: older pages are queries of their own. */
  readonly latest: Ref<Ref<PageData, PageArgs> | null>;
  /** Leaves the message's id and text open: its sender chooses the id, to tell it once it lands. */
  readonly send: ActionRef<
    typeof sendMessage,
    { readonly id: string; readonly text: string }
  >;
};

/** A chat on screen: the root of a room's query. */
export const chatRoom = view({
  id: ids.room,
  name: "room",
  access: { queryable: true },
  resolve: (chatId: string, { ref, action, input }): RoomData => ({
    id: chatId,
    summary: ref(chat, chatId, room),
    latest: ref(pageBefore, { chatId, before: null }, room),
    send: action(sendMessage, { chatId, id: input("id"), text: input("text") }),
  }),
});

/**
 * The most recently active chat's room as of opening: the root of the query that shows a room
 * at start, without waiting for the list. A pin, so the query stays on that chat, and its room
 * stays live, when another chat becomes the newest.
 */
export const newestChatOnOpen = pin({
  target: chatRoom,
  id: ids.newestChatOnOpen,
  name: "newestChatOnOpen",
  access: { queryable: true },
  async resolve(_args: undefined, { read, ref }) {
    let newest: ChatRecord | undefined;
    for (const record of await read(chats.all)) {
      if (newest === undefined || record.updatedAt > newest.updatedAt)
        newest = record;
    }
    return newest === undefined ? null : ref(chatRoom, newest.id);
  },
});
