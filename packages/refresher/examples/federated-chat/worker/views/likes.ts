import { view } from "../../../../src/index";
import type { ActionRefTemplate, Ref } from "../../../../src/index";
import { YOU, ids } from "../../shared";
import { likeMessage } from "../actions";
import { likes as likesStore, likesOf } from "../stores/likes";
import { profile } from "./profile";
import type { ProfileData } from "./profile";
import { room } from "./tags";

/** How many of a message's likers it shows. */
const SHOWN = 3;

export type LikesData = {
  readonly count: number;
  /** The `SHOWN` users who liked it last, the latest first. */
  readonly latest: readonly Ref<ProfileData>[];
  /** Whether You like it. */
  readonly liked: boolean;
  /** Likes it as You, or takes your like back: `liked` says which. */
  readonly like: ActionRefTemplate<
    typeof likeMessage,
    { readonly liked: boolean }
  >;
};

/** A message's likes: its own instance, so a like reruns it alone rather than the message. */
export const likes = view({
  id: ids.likes,
  name: "likes",
  async resolve(
    messageId: string,
    { read, ref, action, input },
  ): Promise<LikesData> {
    const [count, latest, mine] = await Promise.all([
      read(likesStore.count.byMessage, likesOf(messageId)),
      read(likesStore.range.byMessage, {
        ...likesOf(messageId),
        direction: "prev",
        limit: SHOWN,
      }),
      read(likesStore.byId, [messageId, YOU]),
    ]);
    return {
      count,
      latest: latest.map((like) => ref(profile, like.user, room)),
      liked: mine !== undefined,
      like: action(likeMessage, { messageId, liked: input("liked") }),
    };
  },
});
