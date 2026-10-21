import type { ReactNode } from "react";
import { view } from "../../../../src/index";
import type { ActionRef, ExternalRef, Ref } from "../../../../src/index";
import { render, useData, useHandler } from "../../lib/react";
import type { DataRef } from "../../lib/react";
import type { MessageData, PageBeforeArgs } from "../../worker/views/messages";
import type { AppContext } from "../worker";
import { messageRef, pageQuery, worker } from "../stores/worker";
import type { PageRef } from "../stores/worker";
import { ui } from "../stores/ui";
import type { OlderPage } from "../stores/ui";
import { MessageRow, messageRowView, pendingRowView } from "./MessageRow";
import type { RowData } from "./MessageRow";

/** How many pages the list shows at once. */
const WINDOW = 3;

/**
 * The older pages on screen, of those found so far, newest first, when the list hides `skip`
 * of the room's pages, the latest first. Their queries are open while they are on screen.
 */
export function shownPages(
  pages: readonly OlderPage[],
  skip: number,
): readonly OlderPage[] {
  return pages.slice(Math.max(0, skip - 1), skip + WINDOW - 1);
}

/**
 * Opens an older page's query, at once if the worker store kept the page. `undefined`, holding
 * nothing open, if the list moved or the chat was left meanwhile.
 */
async function openPage(
  args: PageBeforeArgs,
  { read, queries }: AppContext,
): Promise<PageRef | undefined> {
  const pages = read(ui.pages);
  const skip = read(ui.skip);
  const ref =
    queries.reopen(pageQuery, args) ?? (await queries.open(pageQuery, args));
  if (
    read(ui.selected) === args.chatId &&
    read(ui.pages) === pages &&
    read(ui.skip) === skip
  )
    return ref;
  queries.close(pageQuery, args);
  return undefined;
}

/**
 * Shows the page before the oldest on screen, found now or before. With the list full, hides
 * the newest, closing its query unless it is the latest page, which the room's query brings.
 */
export async function showOlder(
  args: PageBeforeArgs,
  context: AppContext,
): Promise<void> {
  const { read, store, queries } = context;
  const pages = read(ui.pages);
  const skip = read(ui.skip);
  const ref = await openPage(args, context);
  if (ref === undefined) return;
  const shown = Math.min(WINDOW, pages.length + 1 - skip);
  const found =
    skip + shown - 1 < pages.length ? pages : [...pages, { args, ref }];
  if (shown < WINDOW) return store(ui).set({ pages: found });
  const newest = pages[skip - 1];
  if (newest !== undefined) queries.close(pageQuery, newest.args);
  store(ui).set({ pages: found, skip: skip + 1 });
}

/** Shows the page after the newest on screen again, hiding the oldest and closing its query. */
export async function showNewer(
  _args: undefined,
  context: AppContext,
): Promise<void> {
  const { read, store, queries } = context;
  const pages = read(ui.pages);
  const skip = read(ui.skip);
  if (skip === 0) return;
  // The latest page, when it is the one to show, is the room's query's.
  const newer = pages[skip - 2];
  if (
    newer !== undefined &&
    (await openPage(newer.args, context)) === undefined
  )
    return;
  const oldest = pages[skip + WINDOW - 2];
  if (oldest !== undefined) queries.close(pageQuery, oldest.args);
  store(ui).set({ skip: skip - 1 });
}

export type PageRowsArgs = {
  readonly chatId: string;
  /** The page's pin, as its query brings it. */
  readonly root: PageRef;
  /** Whether it is the latest page, which pending messages join. */
  readonly latest: boolean;
};

/**
 * A page's rows: the worker's, then, on the latest page, every pending message no row
 * confirms yet. See docs/architecture/federation.md.
 */
export const pageRowsView = view({
  name: "Page",
  resolve(
    { chatId, root, latest }: PageRowsArgs,
    { read, ref },
  ): readonly Ref<RowData>[] {
    const page = read(worker.views, root);
    const confirmed = page === null ? [] : read(worker.views, page).messages;
    const rows = confirmed.map((message) =>
      ref(messageRowView, message, render),
    );
    if (!latest) return rows;
    const landed = new Set<ExternalRef<MessageData | null>>(confirmed);
    return [
      ...rows,
      ...read(ui.pending, chatId)
        .filter((id) => !landed.has(messageRef(id)))
        .map((id) => ref(pendingRowView, id, render)),
    ];
  },
});

export type MessageListArgs = {
  readonly chatId: string;
  /** The room's latest page, as of opening the room. */
  readonly latest: PageRef;
};

export type MessageListData = {
  /** Offered while a message is older than the pages on screen. */
  readonly older: ActionRef<typeof showOlder> | null;
  /** The pages on screen, oldest first. */
  readonly pages: readonly Ref<readonly Ref<RowData>[]>[];
  /** Offered while the list hides newer pages. */
  readonly newer: ActionRef<typeof showNewer> | null;
};

/** Up to `WINDOW` pages: the latest and older ones, or older ones only once it hides newer. */
export const messageListView = view({
  name: "MessageList",
  resolve(
    { chatId, latest }: MessageListArgs,
    { read, ref, action },
  ): MessageListData {
    const skip = read(ui.skip);
    const older = shownPages(read(ui.pages), skip).map((page) => page.ref);
    const roots = skip === 0 ? [latest, ...older] : older;
    const oldest = roots.at(-1);
    const page = oldest === undefined ? null : read(worker.views, oldest);
    const before = page === null ? null : read(worker.views, page).older;
    return {
      older: before === null ? null : action(showOlder, before),
      pages: roots
        .map((root) =>
          ref(pageRowsView, { chatId, root, latest: root === latest }, render),
        )
        .reverse(),
      newer: skip === 0 ? null : action(showNewer),
    };
  },
});

function Page({
  dataRef,
}: {
  readonly dataRef: DataRef<readonly Ref<RowData>[]>;
}): ReactNode {
  return useData(dataRef).map((row) => <MessageRow key={row} dataRef={row} />);
}

export function MessageList({
  dataRef,
}: {
  readonly dataRef: DataRef<MessageListData>;
}): ReactNode {
  const list = useData(dataRef);
  const handler = useHandler();
  return (
    <div className="history">
      <div>
        {list.older !== null && (
          <button type="button" className="more" onClick={handler(list.older)}>
            Older messages
          </button>
        )}
        <ol>
          {list.pages.map((page) => (
            <Page key={page} dataRef={page} />
          ))}
        </ol>
        {list.newer !== null && (
          <button type="button" className="more" onClick={handler(list.newer)}>
            Newer messages
          </button>
        )}
      </div>
    </div>
  );
}
