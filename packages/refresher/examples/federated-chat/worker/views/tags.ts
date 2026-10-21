/**
 * The worker's data graph is linked by refs. The main thread reaches it only through remote
 * queries rooted at `chats`, `newestChatOnOpen`, `room` and `pageBefore`; each tag says which
 * query follows a ref: `sidebar`, the list's, and `room`, a room's, a page's and the newest
 * chat's. The writes it offers are action refs, which the main thread runs by sending them back.
 */

export const sidebar = { tags: ["sidebar"] } as const;
export const room = { tags: ["room"] } as const;
