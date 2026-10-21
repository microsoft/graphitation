import type { ChatRecord, MessageRecord } from "../../shared";
import { YOU } from "../../shared";
import { withMessage } from "../stores/chats";
import type { Writes } from "./database";

/**
 * The chats a fresh database starts with, oldest first, and their messages: author, text, and
 * who likes it, in the order they liked it.
 */
const seed: readonly (readonly [
  title: string,
  messages: readonly (readonly [
    author: string,
    text: string,
    likers?: readonly string[],
  ])[],
])[] = [
  [
    "Federation",
    [
      ["Ada", "The sidebar and header read chat summaries from the worker."],
      ["Grace", "Selection and the menu never leave the main thread."],
      [YOU, "So one render waits for one batch, however deep the tree?"],
      [
        "Ada",
        "One batch per round. Remote leaves in a round travel together.",
        ["Grace", "Linus", "Margaret", "Alan", "Barbara"],
      ],
    ],
  ],
  [
    "IndexedDB",
    [
      ["Linus", "Messages persist in IndexedDB, and only the worker opens it."],
      ["Margaret", "Reload the page: the history is still here.", ["Linus"]],
    ],
  ],
  [
    "Scratch",
    [["Grace", "Send something. The worker replies after a moment."]],
  ],
];

/** Writes the seed into a fresh database. */
export function plantSeed({ chats, messages, likes, now }: Writes): void {
  for (const [title, sent] of seed) {
    let chat: ChatRecord = {
      id: crypto.randomUUID(),
      title,
      createdAt: now(),
      updatedAt: 0,
      count: 0,
      last: null,
      liked: null,
    };
    for (const [author, text, likers = []] of sent) {
      const message: MessageRecord = {
        id: crypto.randomUUID(),
        chatId: chat.id,
        author,
        text,
        sentAt: now(),
      };
      messages.put(message);
      for (const user of likers)
        likes.put({
          messageId: message.id,
          chatId: chat.id,
          user,
          likedAt: now(),
        });
      chat = withMessage(chat, message);
    }
    chats.put(chat);
  }
}
