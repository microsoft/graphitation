import type { ReactNode } from "react";
import { view } from "../../../../src/index";
import type { ExternalRef } from "../../../../src/index";
import { useData } from "../../lib/react";
import type { DataRef } from "../../lib/react";
import type { ChatSummary } from "../../worker/views/chats";
import { worker } from "../stores/worker";
import type { RoomFollowed } from "../stores/worker";

export type HeaderData = {
  readonly title: string;
  readonly count: number;
} | null;

export const headerView = view({
  name: "Header",
  resolve(
    summary: ExternalRef<ChatSummary | null, RoomFollowed>,
    { read },
  ): HeaderData {
    const chat = read(worker.views, summary);
    return chat === null ? null : { title: chat.title, count: chat.count };
  },
});

export function Header({
  dataRef,
}: {
  readonly dataRef: DataRef<HeaderData>;
}): ReactNode {
  const header = useData(dataRef);
  if (header === null) return <h2>Chat not found</h2>;
  return (
    <h2>
      {header.title} <small>{header.count} messages</small>
    </h2>
  );
}
