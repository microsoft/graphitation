import type { ReactNode } from "react";
import { view } from "../../../../src/index";
import type { Ref } from "../../../../src/index";
import { render, useData } from "../../lib/react";
import type { DataRef } from "../../lib/react";
import { worker } from "../stores/worker";
import type { ChatsRef } from "../stores/worker";
import { ChatLink, chatLinkView } from "./ChatLink";
import type { ChatLinkData } from "./ChatLink";
import { Menu, menuView } from "./Menu";
import type { MenuData } from "./Menu";

export type SidebarData = {
  readonly menu: Ref<MenuData>;
  readonly chats: readonly Ref<ChatLinkData>[];
};

/** Every chat the sidebar's query listed, one link each: the one on screen, the one navigated to. */
export const sidebarView = view({
  name: "Sidebar",
  resolve: (
    {
      chats,
      active,
      navigating,
    }: {
      readonly chats: ChatsRef;
      readonly active: string | null;
      readonly navigating: string | null;
    },
    { read, ref },
  ): SidebarData => {
    const { entries, create } = read(worker.views, chats);
    const current = entries.find((entry) => entry.id === active);
    return {
      menu: ref(menuView, { create, active: current?.summary ?? null }, render),
      chats: entries.map((entry) =>
        ref(
          chatLinkView,
          {
            summary: entry.summary,
            active: entry.id === active,
            navigating: entry.id === navigating,
          },
          render,
        ),
      ),
    };
  },
});

export function Sidebar({
  dataRef,
}: {
  readonly dataRef: DataRef<SidebarData>;
}): ReactNode {
  const sidebar = useData(dataRef);
  return (
    <aside>
      <header>
        <h1>Federated chat</h1>
        <Menu dataRef={sidebar.menu} />
      </header>
      <nav>
        {sidebar.chats.map((chat) => (
          <ChatLink key={chat} dataRef={chat} />
        ))}
      </nav>
    </aside>
  );
}
