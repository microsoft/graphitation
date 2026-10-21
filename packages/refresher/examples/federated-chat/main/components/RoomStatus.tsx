import type { ReactNode } from "react";
import { view } from "../../../../src/index";
import { useData } from "../../lib/react";
import type { DataRef } from "../../lib/react";
import { worker } from "../stores/worker";
import type { RoomRef } from "../stores/worker";

export type RoomStatusData = {
  /** Whether the room's query brings it, or is on its way, the room showing what was kept. */
  readonly state: "live" | "syncing";
};

/** The room's freshness: syncing until its query answers, live after. */
export const roomStatusView = view({
  name: "Room status",
  resolve: (room: RoomRef, { read }): RoomStatusData => ({
    state: read(worker.opening, room) ? "syncing" : "live",
  }),
});

/** One line, always there so nothing moves. */
export function RoomStatus({
  dataRef,
}: {
  readonly dataRef: DataRef<RoomStatusData>;
}): ReactNode {
  const { state } = useData(dataRef);
  return (
    <p className="status" role="status">
      {state === "syncing" ? (
        <span className="syncing">Syncing…</span>
      ) : (
        <span className="live">Live</span>
      )}
    </p>
  );
}
