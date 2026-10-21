export type ChatRecord = {
  readonly id: string;
  readonly title: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  /** How many messages it holds, kept as each is sent, so a summary reads no message. */
  readonly count: number;
  readonly last: { readonly author: string; readonly text: string } | null;
  /** The message You liked last, while the worker waits to hear how many more likes it gets. */
  readonly liked: string | null;
};

export type MessageRecord = {
  readonly id: string;
  readonly chatId: string;
  readonly author: string;
  readonly text: string;
  readonly sentAt: number;
};

/** One user's like of one message: a user likes a message once. */
export type LikeRecord = {
  readonly messageId: string;
  /** Its message's chat, so deleting the chat deletes its likes. */
  readonly chatId: string;
  readonly user: string;
  readonly likedAt: number;
};

export type Init = {
  readonly port: MessagePort;
  /** Where the worker's devtools inspector listens. */
  readonly devtools: MessagePort;
};

/** The ids the worker publishes its views under, and remote refs name. */
export const ids = {
  chats: "ChatListV1",
  newestChatOnOpen: "NewestChatOnOpenV1",
  chat: "ChatV1",
  room: "ChatRoomV1",
  page: "ChatPageV1",
  pageBefore: "ChatPageBeforeV1",
  message: "ChatMessageV1",
  profile: "ChatProfileV1",
  likes: "ChatLikesV1",
} as const;

/** The ids the worker publishes its actions under, and external action refs name. */
export const actionIds = {
  send: "SendMessageV1",
  create: "CreateChatV1",
  delete: "DeleteChatV1",
  like: "LikeMessageV1",
} as const;

export const YOU = "You";
