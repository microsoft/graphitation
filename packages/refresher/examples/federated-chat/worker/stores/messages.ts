import type { MessageRecord } from "../../shared";
import { idbStore } from "../../lib/idb/store";
import type { KeyRange } from "../../lib/idb/store";

/** Every message, by id, and by chat and send time. */
export const messages = idbStore<MessageRecord>()({
  name: "messages",
  primaryKey: { byId: "id" },
  indexes: { byChat: ["chatId", "sentAt"] },
});

/**
 * A chat's messages in `byChat`: sent from `from` on, or from its first if `null`, and before
 * `to` unless it is `null`.
 */
export const sentIn = (
  chatId: string,
  from: number | null,
  to: number | null,
): KeyRange => ({
  // `[chatId]` sorts before the chat's every key, and `[chatId, []]` after: arrays sort last.
  from: from === null ? [chatId] : [chatId, from],
  to: to === null ? [chatId, []] : [chatId, to],
});
