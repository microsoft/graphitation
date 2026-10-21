import { view } from "../../../../src/index";
import type { ActionRef, Ref } from "../../../../src/index";
import { ids } from "../../shared";
import { createChat, deleteChat } from "../actions";
import { chats } from "../stores/chats";
import { sidebar } from "./tags";

export type ChatSummary = {
  readonly id: string;
  readonly title: string;
  readonly count: number;
  readonly preview: string | null;
  readonly delete: ActionRef<typeof deleteChat>;
};

export const chat = view({
  id: ids.chat,
  name: "chat",
  async resolve(id: string, { read, action }): Promise<ChatSummary | null> {
    const record = await read(chats.byId, id);
    if (record === undefined) return null;
    return {
      id,
      title: record.title,
      count: record.count,
      preview:
        record.last === null
          ? null
          : `${record.last.author}: ${record.last.text}`,
      delete: action(deleteChat, id),
    };
  },
});

export type ChatEntry = {
  readonly id: string;
  readonly summary: Ref<ChatSummary | null>;
};

export type ChatsData = {
  /** Most recently active first. */
  readonly entries: readonly ChatEntry[];
  readonly create: ActionRef<typeof createChat>;
};

/** Every chat: the root of the sidebar's query. */
export const chatList = view({
  id: ids.chats,
  name: "chats",
  access: { queryable: true },
  async resolve(_args: undefined, { read, ref, action }): Promise<ChatsData> {
    const records = [...(await read(chats.all))];
    records.sort((a, b) => b.updatedAt - a.updatedAt);
    return {
      entries: records.map((record) => ({
        id: record.id,
        summary: ref(chat, record.id, sidebar),
      })),
      create: action(createChat),
    };
  },
});
