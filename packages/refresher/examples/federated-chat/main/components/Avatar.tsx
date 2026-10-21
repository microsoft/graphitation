import type { ReactNode } from "react";
import type { ExternalRef } from "../../../../src/index";
import { useData } from "../../lib/react";
import type { DataRef } from "../../lib/react";
import type { ProfileData } from "../../worker/views/profile";
import type { PageFollowed } from "../stores/worker";

/**
 * The worker's `profile`, read straight from its room's answers: no main-thread view in
 * between. An author's profile is one instance across every chat. A like not yet confirmed
 * shows the main thread's own.
 */
export function Avatar({
  dataRef,
}: {
  readonly dataRef:
    | ExternalRef<ProfileData, PageFollowed>
    | DataRef<ProfileData>;
}): ReactNode {
  const profile = useData(dataRef);
  return (
    <span
      className="avatar"
      title={profile.name}
      style={{ background: profile.color }}
    >
      {profile.initials}
    </span>
  );
}
