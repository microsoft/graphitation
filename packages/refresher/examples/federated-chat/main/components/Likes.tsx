import type { ReactNode } from "react";
import { view } from "../../../../src/index";
import type {
  ActionRef,
  ExternalActionRef,
  ExternalRef,
  Ref,
} from "../../../../src/index";
import { render, useData, useHandler } from "../../lib/react";
import type { DataRef } from "../../lib/react";
import { YOU } from "../../shared";
import type * as workerActions from "../../worker/actions";
import type { LikesData } from "../../worker/views/likes";
import { profileOf } from "../../worker/views/profile";
import type { ProfileData } from "../../worker/views/profile";
import type { AppContext } from "../worker";
import { ui } from "../stores/ui";
import { worker } from "../stores/worker";
import type { PageFollowed } from "../stores/worker";
import { Avatar } from "./Avatar";

/** How many of a message's likers it shows, as the worker's `likes` answers them. */
const SHOWN = 3;

/**
 * Runs the worker's `like`, the message's, for the opposite of what the row shows, showing it
 * at once. Only the latest of several presses counts: the worker's answers to the ones before
 * it are ignored until it settles, and then until one shows it.
 */
export async function toggleLike(
  {
    messageId,
    liked,
    likes,
    like,
  }: {
    readonly messageId: string;
    /** Whether the row shows it liked now. */
    readonly liked: boolean;
    readonly likes: ExternalRef<LikesData, PageFollowed>;
    readonly like: ExternalActionRef<
      typeof workerActions.likeMessage,
      { readonly liked: boolean }
    >;
  },
  { read, store, run }: AppContext,
): Promise<void> {
  const request = store(ui).requestLike(messageId, !liked);
  try {
    await run(like, { liked: !liked });
  } catch (error) {
    store(ui).failLike(messageId, request);
    throw error;
  }
  store(ui).settleLike(
    messageId,
    request,
    read(worker.views, likes).liked === !liked,
  );
}

/** Your profile, as a like not yet confirmed shows it: the worker's comes with its answer. */
export const ownProfileView = view({
  name: "OwnProfile",
  resolve: (_args: undefined): ProfileData => profileOf(YOU),
});

export type LikesRowData = {
  readonly liked: boolean;
  /** The like button's label: what pressing it does. */
  readonly label: string;
  /** The worker's own refs, the avatars reading their profiles from its answers, and yours. */
  readonly likers: readonly (
    | ExternalRef<ProfileData, PageFollowed>
    | Ref<ProfileData>
  )[];
  /** How many more like it than the avatars show, `null` if none. */
  readonly more: string | null;
  readonly toggle: ActionRef<typeof toggleLike>;
};

export type LikesArgs = {
  readonly messageId: string;
  readonly likes: ExternalRef<LikesData, PageFollowed>;
};

/** A message's likes, as the worker's `likes` answers them, and a like not yet confirmed. */
export const likesView = view({
  name: "Likes",
  resolve(
    { messageId, likes }: LikesArgs,
    { read, ref, action },
  ): LikesRowData {
    const confirmed = read(worker.views, likes);
    const pending = read(ui.liking, messageId);
    const liked = pending ?? confirmed.liked;
    let { count } = confirmed;
    let likers: LikesRowData["likers"] = confirmed.latest;
    if (liked !== confirmed.liked && liked) {
      count++;
      likers = [
        ref(ownProfileView, undefined, render),
        ...confirmed.latest,
      ].slice(0, SHOWN);
    } else if (liked !== confirmed.liked) {
      count--;
      likers = confirmed.latest.filter(
        (liker) => read(worker.views, liker).name !== YOU,
      );
    }
    return {
      liked,
      label: liked ? "Unlike" : "Like",
      likers,
      more: count > likers.length ? `+${count - likers.length} more` : null,
      toggle: action(toggleLike, {
        messageId,
        liked,
        likes,
        like: confirmed.like,
      }),
    };
  },
});

export function Likes({
  dataRef,
}: {
  readonly dataRef: DataRef<LikesRowData>;
}): ReactNode {
  const likes = useData(dataRef);
  const handler = useHandler();
  return (
    <div className="likes">
      <button
        type="button"
        aria-pressed={likes.liked}
        title={likes.label}
        onClick={handler(likes.toggle)}
      >
        {likes.liked ? "♥" : "♡"}
      </button>
      {likes.likers.map((liker) => (
        <Avatar key={liker} dataRef={liker} />
      ))}
      {likes.more !== null && <span className="more-likes">{likes.more}</span>}
    </div>
  );
}
