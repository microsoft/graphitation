import type { LikeRecord } from "../../shared";
import { idbStore } from "../../lib/idb/store";
import type { KeyRange } from "../../lib/idb/store";

/** Every like, by message and user, by message and when it was liked, and by chat. */
export const likes = idbStore<LikeRecord>()({
  name: "likes",
  primaryKey: { byId: ["messageId", "user"] },
  indexes: {
    byMessage: ["messageId", "likedAt"],
    byChat: ["chatId", "likedAt"],
  },
});

/** Every like of a message in `byMessage`, or of a chat's messages in `byChat`, by `id`. */
export const likesOf = (id: string): KeyRange => ({
  // `[id]` sorts before every key starting with it, and `[id, []]` after: arrays sort last.
  from: [id],
  to: [id, []],
});
