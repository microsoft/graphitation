import type { ReactNode } from "react";
import { view } from "../../../../src/index";
import type { Ref } from "../../../../src/index";
import { render, useData } from "../../lib/react";
import type { DataRef } from "../../lib/react";
import { worker } from "../stores/worker";
import type { RoomRef } from "../stores/worker";
import { Composer, composerView } from "./Composer";
import type { ComposerData } from "./Composer";
import { Header, headerView } from "./Header";
import type { HeaderData } from "./Header";
import { MessageList, messageListView } from "./MessageList";
import type { MessageListData } from "./MessageList";
import { RoomStatus, roomStatusView } from "./RoomStatus";
import type { RoomStatusData } from "./RoomStatus";

export type RoomData = {
  readonly header: Ref<HeaderData>;
  readonly messages: Ref<MessageListData>;
  readonly status: Ref<RoomStatusData>;
  readonly composer: Ref<ComposerData>;
};

/** A chat on screen, layered over the root of the room's query that navigating to it opened. */
export const roomView = view({
  name: "Room",
  resolve: (
    { chatId, room }: { readonly chatId: string; readonly room: RoomRef },
    { read, ref },
  ): RoomData => {
    const { summary, latest, send } = read(worker.views, room);
    return {
      header: ref(headerView, summary, render),
      messages: ref(messageListView, { chatId, latest }, render),
      status: ref(roomStatusView, room, render),
      composer: ref(composerView, { chatId, summary, send }, render),
    };
  },
});

export function Room({
  dataRef,
}: {
  readonly dataRef: DataRef<RoomData>;
}): ReactNode {
  const room = useData(dataRef);
  return (
    <section className="room">
      <Header dataRef={room.header} />
      <MessageList dataRef={room.messages} />
      <RoomStatus dataRef={room.status} />
      <Composer dataRef={room.composer} />
    </section>
  );
}
