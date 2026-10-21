import type { Revision } from "../../../src/index";
import type { ActionContext } from "../lib/actions";
import type { HybridClock } from "../lib/clock";
import {
  failedFromHost,
  summarizeFromHost,
  summarizeToHost,
} from "../lib/devtools/trace";
import type { Tracer } from "../lib/devtools/trace";
import { connectRemote } from "../lib/remote";
import type { RemoteConnection } from "../lib/remote";
import type { FromHost } from "../lib/protocol";
import { worker } from "./stores/worker";

/**
 * What actions need besides Refresher's context: the worker's queries, as only actions
 * start and stop them.
 */
export type Services = {
  readonly queries: Pick<RemoteConnection, "open" | "close" | "reopen">;
};

/** What every action of this application runs with, as `main.tsx` wires it. */
export type AppContext = ActionContext<Services>;

/**
 * Federation over one port. `clock` observes the revision every message from the worker is
 * stamped with, before the remote connection takes it in; `tracer` traces every message
 * either way. `afterReceive` runs after every message the remote connection took in.
 * `latency` delays every message from the worker, in order, by as many milliseconds as it
 * answers when the message arrives: a slow link, to watch what waits on it.
 */
export function connectWorker(
  port: MessagePort,
  {
    clock,
    tracer,
    afterReceive,
    latestRevision,
    latency,
  }: {
    readonly clock: HybridClock;
    readonly tracer: Pick<Tracer, "wire">;
    readonly afterReceive: () => void;
    /** The runtime's clock, for the remote connection. */
    readonly latestRevision: () => Revision;
    readonly latency: () => number;
  },
): RemoteConnection {
  const remote = connectRemote(worker, {
    latestRevision,
    send(message) {
      tracer.wire("worker", "out", summarizeToHost(message), message, false);
      port.postMessage(message);
    },
  });
  const receive = (message: FromHost): void => {
    clock.observe(message.revision);
    tracer.wire(
      "worker",
      "in",
      summarizeFromHost(message),
      message,
      failedFromHost(message),
    );
    remote.receive(message);
    afterReceive();
  };
  /** When the last delayed message is due: none is due before it, so they stay in order. */
  let due = 0;
  port.addEventListener("message", (event: MessageEvent<FromHost>) => {
    const message = event.data;
    const now = performance.now();
    due = Math.max(due, now + latency());
    if (due > now) setTimeout(() => receive(message), due - now);
    else receive(message);
  });
  port.start();
  return remote;
}
