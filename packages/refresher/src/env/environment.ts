/**
 * Environments for hosts that bring none of their own. Each schedules rounds once the
 * microtask queue has drained; passes, at the same point, or in a microtask on a UI thread.
 */
import type { CreateEnvironmentFn, Environment } from "../api.env";

type Schedule = (callback: () => void) => void;

/** Node: a tick queued from a microtask runs only once the microtask queue drains. */
const afterNodeMicrotasks: Schedule = (callback) => {
  void Promise.resolve().then(() => process.nextTick(callback));
};

/** Node: rounds and passes both once the microtask queue drains. */
export const nodeEnvironment: Environment = {
  scheduleReadRound: afterNodeMicrotasks,
  scheduleUpdatePass: afterNodeMicrotasks,
};

/**
 * Any host with `MessageChannel`: a message runs in a later task, after the microtask
 * queue drains. The channel closes whenever nothing waits on it, so it keeps no host alive.
 */
function createMessageChannelSchedule(): Schedule {
  let channel: MessageChannel | undefined;
  let queue: (() => void)[] = [];
  const run = (): void => {
    const callbacks = queue;
    queue = [];
    for (const callback of callbacks) callback();
    if (queue.length === 0) {
      channel?.port1.close();
      channel = undefined;
    }
  };
  return (callback) => {
    queue.push(callback);
    if (channel === undefined) {
      channel = new MessageChannel();
      channel.port1.addEventListener("message", run);
      channel.port1.start();
    }
    channel.port2.postMessage(undefined);
  };
}

/**
 * Any host with `MessageChannel`, such as a worker: rounds and passes both in a later task,
 * so a pass gathers whatever the task that wrote queued.
 */
export const createMessageChannelEnvironment: CreateEnvironmentFn = () => {
  const schedule = createMessageChannelSchedule();
  return { scheduleReadRound: schedule, scheduleUpdatePass: schedule };
};

/**
 * A UI thread, such as a browser's main thread: passes in a microtask, so a synchronous
 * write renders in the task that wrote it; rounds in a later task, as
 * `createMessageChannelEnvironment` schedules them.
 */
export const createMainThreadEnvironment: CreateEnvironmentFn = () => ({
  scheduleReadRound: createMessageChannelSchedule(),
  scheduleUpdatePass: (callback) => queueMicrotask(callback),
});

/** Node's where it runs, `MessageChannel` elsewhere. */
export const defaultEnvironment: Environment =
  typeof process === "object" && typeof process.nextTick === "function"
    ? nodeEnvironment
    : createMessageChannelEnvironment();
