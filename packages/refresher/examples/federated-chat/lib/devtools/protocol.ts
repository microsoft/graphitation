/**
 * Between the devtools and what they inspect: an inspector in each runtime, reached over a
 * link of its own, so its messages never show as the application's activity. Values cross
 * described, as plain data: see `describe.ts`.
 */

/** A store change, as the activity tab lists it. */
export type TracedChange = {
  readonly store: string;
  readonly operation: string;
  /** What it changed, in one line: its key, when its value has one. */
  readonly label: string;
  /** Its value, described. */
  readonly value: unknown;
};

/** Why a restart ran an instance again: the change that hit it, or nothing could confirm it. */
export type TracedHit = { readonly instance: string } & (
  | {
      readonly kind: "hit";
      readonly store: string;
      readonly operation: string;
      readonly label: string;
      /** The revision the change came in. */
      readonly revision: number;
    }
  | { readonly kind: "unverifiable" }
);

/** An instance a run evaluated: its label, and its data and errors, described. */
export type TracedInstance = {
  readonly label: string;
  readonly data: unknown;
  readonly errors: readonly string[];
  /** The store reads it depends on, inline reads included: what a change must hit to rerun it. */
  readonly reads: readonly TracedRead[];
  /** A pin that kept its answer: it never reruns, so it depends on no store reads. */
  readonly pinned: boolean;
};

/** A store read an instance depends on. */
export type TracedRead = {
  /** The store view and its arguments. */
  readonly label: string;
  /** The revision its answer reflects: only changes after it are matched. */
  readonly revision: number;
  /** What the answer covered, as the store view reported it; `null` when it reported none. */
  readonly footprint: string | null;
};

/** A message between runtimes: its peer, and which it was that way, counted from 1. */
export type TracedMessage = { readonly peer: string; readonly n: number };

/**
 * Something a runtime did, as the activity tab places it. `seq` counts a side's events;
 * `at` is when, on the side's hybrid clock, so events of every side share one time axis.
 */
export type TraceEvent = {
  /** The runtime it happened in. */
  readonly side: string;
  readonly seq: number;
  readonly at: number;
} & (
  | /** A delivery of the runtime's feed: what changed at `revision`, if anything. */
  {
      readonly kind: "revision";
      readonly revision: number;
      readonly changes: readonly TracedChange[];
    }
  /** A pass: the queries its runtime started or restarted at once, at `revision`. */
  | { readonly kind: "pass"; readonly revision: number }
  /** A query a pass ran, started from its roots or restarted for its hits, or an action read. */
  | {
      readonly kind: "query";
      /** The `seq` of its pass, or of the action that read it. */
      readonly parent: number;
      readonly restart: boolean;
      /** Run for an action, which reads it once. */
      readonly immediate: boolean;
      readonly roots: readonly string[];
      readonly hits: readonly TracedHit[];
    }
  /** An action, as it starts: its name, and its arguments described. */
  | {
      readonly kind: "action";
      /** The `seq` of the action that ran it, or answered with it; `null` from outside one. */
      readonly parent: number | null;
      readonly label: string;
      readonly args: unknown;
      /** What a remote action's ref left open, as given to fill it; `null` for a local one. */
      readonly inputs: unknown;
      /** Another runtime's action ref, sent there to run: the message carrying it says where. */
      readonly remote: boolean;
      /** Run for another runtime: the message that asked for it. */
      readonly via: TracedMessage | null;
    }
  /** What a query or action, by its `seq`, answered or failed with. */
  | {
      readonly kind: "settled";
      readonly of: number;
      readonly failed: boolean;
      /** Milliseconds it took. */
      readonly took: number;
      readonly summary: string;
      /** The instances a query's run evaluated; `null` for an action. */
      readonly instances: readonly TracedInstance[] | null;
      /** What an action answered or a run threw, described, by name; `null` for a query's answer. */
      readonly payload: Readonly<Record<string, unknown>> | null;
    }
  /**
   * A message to or from another runtime, its `n`th that way: a port keeps them in order,
   * so the sender's `n`th out is the receiver's `n`th in.
   */
  | {
      readonly kind: "wire";
      readonly peer: string;
      readonly direction: "out" | "in";
      readonly n: number;
      readonly summary: string;
      readonly payload: unknown;
      readonly failed: boolean;
      /** The `seq` of the action it sends another runtime to run. */
      readonly carries: number | null;
    }
);

/** A view an inspector can run. */
export type ViewInfo = {
  /** The view's id in its runtime, as its codec issued it. */
  readonly key: string;
  readonly name: string;
  readonly kind: "derived" | "store" | "pin";
  /** The store a store view reads. */
  readonly store: string | null;
  /** What it permits, of `queryable`, `readable` and `referenceable`. */
  readonly access: readonly string[];
};

/** A store an inspector lists, and the edits it takes. */
export type StoreInfo = {
  readonly name: string;
  /** Takes a new value for an entry, by its key. */
  readonly put: boolean;
  /** Takes a new entry, its key in its value. */
  readonly add: boolean;
  readonly delete: boolean;
};

/** What a watch runs: a view and its arguments, a ref a result held, or a store's entries. */
export type Target =
  | { readonly kind: "view"; readonly view: string; readonly args: unknown }
  | { readonly kind: "ref"; readonly handle: number }
  | { readonly kind: "store"; readonly store: string };

/** Devtools to inspector. `key` names what answers. */
export type ToInspector =
  | { readonly type: "list" }
  /** Runs `target`, and answers again on every restart, until unwatched. */
  | { readonly type: "watch"; readonly key: string; readonly target: Target }
  | { readonly type: "unwatch"; readonly key: string }
  /** Runs the action ref a result held, with values for its open inputs, answering once. */
  | {
      readonly type: "run";
      readonly key: string;
      readonly handle: number;
      readonly inputs: Readonly<Record<string, unknown>>;
    }
  /** Edits a store, answering once: `entry` is the key, unless adding. */
  | {
      readonly type: "edit";
      readonly key: string;
      readonly store: string;
      readonly operation: "put" | "add" | "delete";
      readonly entry: unknown;
      readonly value: unknown;
    };

/** Inspector to devtools. */
export type FromInspector =
  | {
      readonly type: "listed";
      readonly views: readonly ViewInfo[];
      readonly stores: readonly StoreInfo[];
    }
  /** A watch's latest result, or what a run or an edit answered. */
  | {
      readonly type: "result";
      readonly key: string;
      readonly value: unknown;
      readonly errors: readonly string[];
    }
  | { readonly type: "failed"; readonly key: string; readonly message: string }
  | { readonly type: "trace"; readonly event: TraceEvent };

/** The devtools' end of a link to an inspector. */
export type InspectorLink = {
  send(message: ToInspector): void;
  listen(listener: (message: FromInspector) => void): void;
};

/** An inspector, as a link delivers to it. */
export type Inspector = { receive(message: ToInspector): void };

/** A link over a port: an inspector listens at its other end. */
export function portLink(port: MessagePort): InspectorLink {
  return {
    send: (message) => port.postMessage(message),
    listen(listener) {
      port.addEventListener("message", (event: MessageEvent<FromInspector>) =>
        listener(event.data),
      );
      port.start();
    },
  };
}

/** An inspector's end of a port: what it receives, and how it answers. */
export function servePort(
  port: MessagePort,
  start: (send: (message: FromInspector) => void) => Inspector,
): (message: FromInspector) => void {
  const send = (message: FromInspector): void => port.postMessage(message);
  const inspector = start(send);
  port.addEventListener("message", (event: MessageEvent<ToInspector>) =>
    inspector.receive(event.data),
  );
  port.start();
  return send;
}

/** A link to an inspector in the same thread: each message is delivered in a microtask, as a port would later. */
export function localLink(
  start: (send: (message: FromInspector) => void) => Inspector,
): InspectorLink {
  const listeners: ((message: FromInspector) => void)[] = [];
  const inspector = start((message) =>
    queueMicrotask(() => {
      for (const listener of listeners) listener(message);
    }),
  );
  return {
    send: (message) => queueMicrotask(() => inspector.receive(message)),
    listen: (listener) => void listeners.push(listener),
  };
}
