import type { ChatRecord, MessageRecord } from "../../shared";
import { idbStore } from "../../lib/idb/store";

/** Every chat, by id. */
export const chats = idbStore<ChatRecord>()({
  name: "chats",
  primaryKey: { byId: "id" },
});

/** A chat's record once `message` is sent to it. */
export const withMessage = (
  chat: ChatRecord,
  message: MessageRecord,
): ChatRecord => ({
  ...chat,
  updatedAt: message.sentAt,
  count: chat.count + 1,
  last: { author: message.author, text: message.text },
});
