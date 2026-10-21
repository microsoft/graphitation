/**
 * The worker's actions: the only writes to its data, each one database transaction. Its views
 * offer them, and the main thread runs them by sending the action refs back.
 */
import type { ChatRecord } from "../shared";
import { YOU } from "../shared";
import type { ChatDatabase, Writes } from "./db/database";
import { withMessage } from "./stores/chats";
import { likesOf } from "./stores/likes";
import { sentIn } from "./stores/messages";

/** What the worker's actions run with. */
export type WorkerContext = {
  readonly database: ChatDatabase;
  /** Has the worker answer in the chat, a moment later. */
  readonly reply: (chatId: string) => void;
  /** Runs one of the worker's actions a moment later, as the worker answering. */
  readonly later: <Args>(
    action: (args: Args, context: WorkerContext) => Promise<void>,
    args: Args,
  ) => void;
};

/** The worker's name, as it signs what it sends. */
const WORKER = "Worker";

/** Who else likes messages: made up, for `answerLikes` to add. */
const FANS = [
  "Ada",
  "Alan",
  "Anders",
  "Barbara",
  "Bjarne",
  "Brendan",
  "Dennis",
  "Donald",
  "Edsger",
  "Frances",
  "Grace",
  "Guido",
  "Hedy",
  "John",
  "Ken",
  "Linus",
  "Margaret",
  "Niklaus",
  "Radia",
  "Tim",
];

/** The most likes one answer adds. */
const MOST_LIKES = 10;

/** How to answer the worker's question about a like. */
const ANSWERS = `Send a number from 0 to ${MOST_LIKES} for that many more likes, or -1 to remove your like.`;

/** A message's text, quoted and cut short. */
const quote = (text: string): string =>
  `"${text.length > 40 ? `${text.slice(0, 39)}…` : text}"`;

const likesText = (count: number): string =>
  count === 1 ? "1 like" : `${count} likes`;

/** Sends a message to a chat in a write, keeping its count and last message: answers its record. */
function post(
  { chats, messages, now }: Writes,
  chat: ChatRecord,
  author: string,
  text: string,
  id: string = crypto.randomUUID(),
): ChatRecord {
  const message = { id, chatId: chat.id, author, text, sentAt: now() };
  messages.put(message);
  const posted = withMessage(chat, message);
  chats.put(posted);
  return posted;
}

/** Sends a message to a chat: answers the chat's record, `undefined` if it is gone. */
const send = (
  database: ChatDatabase,
  chatId: string,
  author: string,
  text: string,
  id?: string,
): Promise<ChatRecord | undefined> =>
  database.write(async (writes) => {
    const chat = await writes.chats.get(chatId);
    return chat === undefined
      ? undefined
      : post(writes, chat, author, text, id);
  });

/** What answering the question about a like asks for: a count of likes, `-1` for none of yours. */
function likesAsked(text: string): number | undefined {
  return /^\s*-?\d+\s*$/.test(text) ? Number(text) : undefined;
}

/**
 * Sends `text` as You, under the `id` its sender chose, so it can tell its message once it
 * lands. While the worker waits to hear how many more likes a message gets, a number answers.
 */
export async function sendMessage(
  {
    chatId,
    id,
    text,
  }: { readonly chatId: string; readonly id: string; readonly text: string },
  { database, reply, later }: WorkerContext,
): Promise<void> {
  const chat = await send(database, chatId, YOU, text, id);
  // The chat is gone: nothing to send to.
  if (chat === undefined) return;
  const count = chat.liked === null ? undefined : likesAsked(text);
  if (chat.liked === null || count === undefined) return reply(chatId);
  if (count < -1 || count > MOST_LIKES)
    return later(sendReply, { chatId, text: ANSWERS });
  later(answerLikes, { chatId, messageId: chat.liked, count });
}

/** The worker's own answer in a chat: no view offers it. */
export async function sendReply(
  { chatId, text }: { readonly chatId: string; readonly text: string },
  { database }: WorkerContext,
): Promise<void> {
  await send(database, chatId, WORKER, text);
}

/**
 * Likes a message as You, or takes your like back: whether You like it then is `liked`, however
 * many times it runs, so the last of several runs decides. Once You like it, the worker asks
 * how many more likes it gets, and the chat keeps it as the message the answer is for.
 */
export async function likeMessage(
  {
    messageId,
    liked: like,
  }: { readonly messageId: string; readonly liked: boolean },
  { database, later }: WorkerContext,
): Promise<void> {
  const asked = await database.write(
    async ({ chats, messages, likes, now }) => {
      const message = await messages.get(messageId);
      const chat =
        message === undefined ? undefined : await chats.get(message.chatId);
      if (message === undefined || chat === undefined) return undefined;
      const key = [messageId, YOU];
      if (((await likes.get(key)) !== undefined) === like) return undefined;
      if (!like) {
        likes.delete(key);
        if (chat.liked === messageId) chats.put({ ...chat, liked: null });
        return undefined;
      }
      const likedAt = now();
      likes.put({ messageId, chatId: chat.id, user: YOU, likedAt });
      chats.put({ ...chat, liked: messageId });
      return { chatId: chat.id, messageId, likedAt };
    },
  );
  if (asked !== undefined) later(askLikes, asked);
}

/**
 * The worker's question about your like of a message, the one `likedAt`: how many more likes
 * it gets. Asked only if the chat still waits to hear about it, and that like is still yours:
 * not if You took it back, liked again since, or liked another message.
 */
export async function askLikes(
  {
    chatId,
    messageId,
    likedAt,
  }: {
    readonly chatId: string;
    readonly messageId: string;
    readonly likedAt: number;
  },
  { database }: WorkerContext,
): Promise<void> {
  await database.write(async (writes) => {
    const chat = await writes.chats.get(chatId);
    const message = await writes.messages.get(messageId);
    const like = await writes.likes.get([messageId, YOU]);
    if (
      chat?.liked !== messageId ||
      message === undefined ||
      like?.likedAt !== likedAt
    )
      return;
    post(
      writes,
      chat,
      WORKER,
      `You liked ${quote(
        message.text,
      )}. How many more likes should it get? ${ANSWERS}`,
    );
  });
}

/**
 * The worker's answer to how many more likes a message gets: `count` likes from fans who do
 * not like it yet, or, for `-1`, none of yours. The chat stops waiting for an answer.
 */
export async function answerLikes(
  {
    chatId,
    messageId,
    count,
  }: {
    readonly chatId: string;
    readonly messageId: string;
    readonly count: number;
  },
  { database }: WorkerContext,
): Promise<void> {
  await database.write(async (writes) => {
    const { chats, messages, likes, now } = writes;
    const chat = await chats.get(chatId);
    if (chat === undefined) return;
    const message = await messages.get(messageId);
    let text: string;
    if (message === undefined) text = "That message is gone: like another one.";
    else if (count === -1) {
      likes.delete([messageId, YOU]);
      text = `Removed your like from ${quote(message.text)}.`;
    } else {
      const fans: string[] = [];
      for (const fan of FANS)
        if ((await likes.get([messageId, fan])) === undefined) fans.push(fan);
      let added = 0;
      // A random pick of the fans who do not like it yet.
      for (; added < count && fans.length > 0; added++) {
        const [fan] = fans.splice(Math.floor(Math.random() * fans.length), 1);
        likes.put({ messageId, chatId, user: fan!, likedAt: now() });
      }
      text =
        added === count
          ? `Added ${likesText(added)} to ${quote(message.text)}.`
          : `Every fan likes ${quote(message.text)} now: added ${likesText(
              added,
            )}.`;
    }
    post(writes, { ...chat, liked: null }, WORKER, text);
  });
}

/** Answers with the new chat's id. */
export function createChat(
  _args: undefined,
  { database }: WorkerContext,
): Promise<string> {
  return database.write(({ chats, now }) => {
    const createdAt = now();
    const chat: ChatRecord = {
      id: crypto.randomUUID(),
      title: `Chat ${new Date(createdAt).toLocaleTimeString()}`,
      createdAt,
      updatedAt: createdAt,
      count: 0,
      last: null,
      liked: null,
    };
    chats.put(chat);
    return chat.id;
  });
}

/** Deletes a chat, and every message in it, and their likes. */
export function deleteChat(
  chatId: string,
  { database }: WorkerContext,
): Promise<void> {
  return database.write(async ({ chats, messages, likes }) => {
    chats.delete(chatId);
    await messages.deleteAll("byChat", sentIn(chatId, null, null));
    await likes.deleteAll("byChat", likesOf(chatId));
  });
}

/** Every action the worker's views offer. */
export type WorkerAction =
  | typeof sendMessage
  | typeof createChat
  | typeof deleteChat
  | typeof likeMessage;
