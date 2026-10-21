import type { ChangeFeed, GetStoreFn } from "../../../../src/index";
import type { ChatRecord, LikeRecord, MessageRecord } from "../../shared";
import type { HybridClock } from "../../lib/clock";
import { openIdb } from "../../lib/idb/database";
import type { IdbTransaction } from "../../lib/idb/database";
import type { IdbWrites } from "../../lib/idb/store";
import { chats } from "../stores/chats";
import { likes } from "../stores/likes";
import { messages } from "../stores/messages";
import { plantSeed } from "./seed";

/** What a write runs with: every store's writes, in one transaction, and the database's clock. */
export type Writes = {
  readonly chats: IdbWrites<ChatRecord, "byId">;
  readonly messages: IdbWrites<MessageRecord, "byId" | "byChat">;
  readonly likes: IdbWrites<LikeRecord, "byId" | "byMessage" | "byChat">;
  /** Now, in milliseconds, and later than any time or revision the clock told before. */
  readonly now: () => number;
};

/**
 * The worker's IndexedDB: the handle its stores read through, and a feed of the changes this
 * worker commits. Only committed writes are announced, so a reader never sees a write that
 * rolls back.
 */
export type ChatDatabase = ChangeFeed & {
  readonly store: GetStoreFn;
  /** Runs `run` in one transaction across every store: see `IdbDatabase.write`. */
  write<T>(run: (writes: Writes) => T | Promise<T>): Promise<T>;
};

/** Opens it on `clock`, which stamps its revisions and the times its writes tell. */
export async function openChatDatabase(
  clock: HybridClock,
): Promise<ChatDatabase> {
  const now = (): number => clock.tick();
  const writesIn = (transaction: IdbTransaction): Writes => ({
    chats: transaction.writes(chats),
    messages: transaction.writes(messages),
    likes: transaction.writes(likes),
    now,
  });
  const database = await openIdb({
    name: "refresher-federated-chat",
    // Version 3 keeps likes, and the message each chat's likes were last asked about: an
    // older database starts over.
    version: 3,
    stores: [chats, messages, likes],
    clock,
    create: (transaction) => plantSeed(writesIn(transaction)),
  });
  return {
    store: database.store,
    subscribe: (listener) => database.subscribe(listener),
    write: (run) => database.write((transaction) => run(writesIn(transaction))),
  };
}
