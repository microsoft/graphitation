import { pin, view } from "../../../../src/index";
import type { Ref } from "../../../../src/index";
import { ids } from "../../shared";
import { stringKey } from "../../lib/idb/store";
import { messages, sentIn } from "../stores/messages";
import { likes } from "./likes";
import type { LikesData } from "./likes";
import { profile } from "./profile";
import type { ProfileData } from "./profile";
import { room } from "./tags";

export type MessageData = {
  readonly id: string;
  readonly author: string;
  /** Another instance: shared by every message its author sent, in any chat. */
  readonly avatar: Ref<ProfileData>;
  readonly text: string;
  readonly sentAt: number;
  /** Another instance, so a like reruns only it. */
  readonly likes: Ref<LikesData>;
};

export const message = view({
  id: ids.message,
  name: "message",
  async resolve(id: string, { read, ref }): Promise<MessageData | null> {
    const record = await read(messages.byId, id);
    return record === undefined
      ? null
      : {
          id,
          author: record.author,
          avatar: ref(profile, record.author, room),
          text: record.text,
          sentAt: record.sentAt,
          likes: ref(likes, id, room),
        };
  },
});

/** Refs rather than records: each message is its own instance, and its own answer. */
export type PageData = {
  readonly messages: readonly Ref<MessageData | null>[];
  /** What asks for the page before this one, `null` if no message is older. */
  readonly older: PageBeforeArgs | null;
};

/** A chat's messages sent in `[from, to)`, open-ended when `to` is `null`, in send order. */
export type PageArgs = {
  readonly chatId: string;
  readonly from: number;
  readonly to: number | null;
};

/**
 * A range of a chat's messages: every message sent in it, so one sent into it joins the page
 * rather than pushing another onto the next.
 */
export const page = view({
  id: ids.page,
  name: "page",
  async resolve(
    { chatId, from, to }: PageArgs,
    { read, ref },
  ): Promise<PageData> {
    const [shown, older] = await Promise.all([
      read(messages.keyRange.byChat, sentIn(chatId, from, to)),
      read(messages.keyRange.byChat, {
        ...sentIn(chatId, null, from),
        direction: "prev",
        limit: 1,
      }),
    ]);
    return {
      messages: shown.map((id) => ref(message, stringKey(id), room)),
      older: older.length > 0 ? { chatId, before: from } : null,
    };
  },
});

/** The page before `before`, or the latest page if `null`. */
export type PageBeforeArgs = {
  readonly chatId: string;
  readonly before: number | null;
};

/** How many messages a page holds when its pin finds it. */
export const PAGE_SIZE = 5;

/**
 * The `PAGE_SIZE` messages sent last before `before`, kept as the range they covered: a pin,
 * so a query keeps its page while messages arrive. The latest page is open-ended, so a new
 * message joins it; an older one ends where the page after it begins, so pages neither
 * overlap nor leave gaps.
 */
export const pageBefore = pin({
  target: page,
  id: ids.pageBefore,
  name: "pageBefore",
  access: { queryable: true },
  async resolve({ chatId, before }: PageBeforeArgs, { read, ref }) {
    const last = await read(messages.range.byChat, {
      ...sentIn(chatId, null, before),
      direction: "prev",
      limit: PAGE_SIZE,
    });
    const first = last.at(-1);
    return first === undefined
      ? null
      : ref(page, { chatId, from: first.sentAt, to: before }, room);
  },
});
