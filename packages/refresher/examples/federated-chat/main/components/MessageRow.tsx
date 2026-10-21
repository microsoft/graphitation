import type { ReactNode } from "react";
import { view } from "../../../../src/index";
import type { ExternalRef, Ref } from "../../../../src/index";
import { render, useData } from "../../lib/react";
import type { DataRef } from "../../lib/react";
import { YOU } from "../../shared";
import type { MessageData } from "../../worker/views/messages";
import type { ProfileData } from "../../worker/views/profile";
import { worker } from "../stores/worker";
import type { PageFollowed } from "../stores/worker";
import { ui } from "../stores/ui";
import { Avatar } from "./Avatar";
import { Likes, likesView } from "./Likes";
import type { LikesRowData } from "./Likes";

export type RowData = {
  readonly author: string;
  readonly text: string;
  readonly className: string | undefined;
  /** When it was sent, as `<time>` takes it. */
  readonly dateTime: string;
  /** When it was sent, as the row shows it; "sending…" until the worker confirms it. */
  readonly time: string;
  /** The worker's own ref: the avatar reads its profile from the worker's answers. */
  readonly avatar: ExternalRef<ProfileData, PageFollowed> | null;
  /** `null` until the worker confirms it: no one can like it before. */
  readonly likes: Ref<LikesRowData> | null;
} | null;

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

/** Formats a row once, as its view resolves, so a remounted row formats nothing. */
function rowData(
  {
    author,
    text,
    sentAt,
  }: {
    readonly author: string;
    readonly text: string;
    readonly sentAt: number;
  },
  pending: boolean,
  avatar: ExternalRef<ProfileData, PageFollowed> | null,
  likes: Ref<LikesRowData> | null,
): RowData {
  const mine = author === YOU;
  return {
    author,
    text,
    className:
      mine && pending
        ? "mine pending"
        : mine
        ? "mine"
        : pending
        ? "pending"
        : undefined,
    dateTime: new Date(sentAt).toISOString(),
    time: pending ? "sending…" : timeFormat.format(sentAt),
    avatar,
    likes,
  };
}

/** A confirmed row: the worker's `message`, as its room's query brought it. */
export const messageRowView = view({
  name: "MessageRow",
  resolve(
    message: ExternalRef<MessageData | null, PageFollowed>,
    { read, ref },
  ): RowData {
    const data = read(worker.views, message);
    return data === null
      ? null
      : rowData(
          data,
          false,
          data.avatar,
          ref(likesView, { messageId: data.id, likes: data.likes }, render),
        );
  },
});

/** A row the worker has not confirmed yet: main-thread state alone. */
export const pendingRowView = view({
  name: "PendingRow",
  resolve(id: string, { read }): RowData {
    const sent = read(ui.pendingMessage, id);
    return sent === null
      ? null
      : rowData(
          { author: YOU, text: sent.text, sentAt: sent.sentAt },
          true,
          null,
          null,
        );
  },
});

export function MessageRow({
  dataRef,
}: {
  readonly dataRef: DataRef<RowData>;
}): ReactNode {
  const row = useData(dataRef);
  if (row === null) return null;
  return (
    <li className={row.className}>
      {row.avatar === null ? (
        <span className="avatar">…</span>
      ) : (
        <Avatar dataRef={row.avatar} />
      )}
      <strong>{row.author}</strong>
      <time dateTime={row.dateTime}>{row.time}</time>
      <p>{row.text}</p>
      {row.likes !== null && <Likes dataRef={row.likes} />}
    </li>
  );
}
