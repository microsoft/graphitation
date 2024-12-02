import { TimedEvent } from "./types";

export const createTimedEvent = (start = false): TimedEvent => ({
  time: Number.NaN,
  start: start ? performance.now() : Number.NaN,
});

export function markStart<T extends TimedEvent>(event: T): T {
  event.start = performance.now();
  return event;
}
export function markEnd<T extends TimedEvent>(event: T): T {
  event.time = performance.now() - event.start;
  return event;
}
