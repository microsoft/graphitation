import type { FormEvent, ReactNode } from "react";
import { view } from "../../../../src/index";
import type {
  ActionRef,
  ExternalActionRef,
  ExternalRef,
} from "../../../../src/index";
import { useData, useHandler } from "../../lib/react";
import type { DataRef } from "../../lib/react";
import type * as workerActions from "../../worker/actions";
import type { ChatSummary } from "../../worker/views/chats";
import { worker } from "../stores/worker";
import type { RoomFollowed } from "../stores/worker";
import type { AppContext } from "../worker";
import { ui } from "../stores/ui";

/** The worker's `sendMessage`, as its room offers it: the message's id and text left open. */
export type SendRef = ExternalActionRef<
  typeof workerActions.sendMessage,
  { readonly id: string; readonly text: string }
>;

/**
 * Handles the composer's submit event: takes the message's text from the form and renders
 * the message at once, as pending, until the worker's row replaces it. Runs the worker's
 * `send` with an id of its choosing, so it can tell the row once it lands.
 */
export async function sendMessage(
  { chatId, send }: { readonly chatId: string; readonly send: SendRef },
  { store, run }: AppContext,
  event: FormEvent<HTMLFormElement>,
): Promise<void> {
  // Before the first `await`, while the event is still being dispatched.
  event.preventDefault();
  const form = event.currentTarget;
  const text = new FormData(form).get("text");
  if (typeof text !== "string" || text.trim() === "") return;
  form.reset();
  const id = crypto.randomUUID();
  store(ui).addPending({ id, chatId, text: text.trim(), sentAt: Date.now() });
  try {
    await run(send, { id, text: text.trim() });
  } catch (error) {
    store(ui).dropPending(id);
    throw error;
  }
}

export type ComposerData = {
  readonly placeholder: string;
  readonly submit: ActionRef<typeof sendMessage>;
};

export type ComposerArgs = {
  readonly chatId: string;
  readonly summary: ExternalRef<ChatSummary | null, RoomFollowed>;
  readonly send: SendRef;
};

export const composerView = view({
  name: "Composer",
  resolve(
    { chatId, summary, send }: ComposerArgs,
    { read, action },
  ): ComposerData {
    const chat = read(worker.views, summary);
    return {
      placeholder: `Message ${chat?.title ?? "this chat"}`,
      submit: action(sendMessage, { chatId, send }),
    };
  },
});

export function Composer({
  dataRef,
}: {
  readonly dataRef: DataRef<ComposerData>;
}): ReactNode {
  const composer = useData(dataRef);
  const handler = useHandler();
  return (
    <form className="composer" onSubmit={handler(composer.submit)}>
      <input
        name="text"
        autoComplete="off"
        placeholder={composer.placeholder}
      />
      <button type="submit">Send</button>
    </form>
  );
}
