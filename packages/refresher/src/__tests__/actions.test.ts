import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  Action,
  ActionArgsOf,
  ActionRef,
  ActionRefTemplate,
  ActionResultOf,
  AnyActionRef,
  External,
  ExternalActionRef,
  ExternalRef,
  FollowedRef,
  Ref,
  RefFor,
  StoreView,
  ViewFn,
} from "../index";

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y
  ? 1
  : 2
  ? true
  : false;
const equal = <X, Y>(same: Equal<X, Y>): boolean => same;

const like = (args: { readonly message: string }): Promise<void> =>
  Promise.resolve(args && undefined);
const refresh = (): void => {};

/** An action that is not a function: opaque, its arguments untyped. */
type Archive = { readonly type: "archive"; readonly name?: string };
const archive: Archive = { type: "archive", name: "archive" };

type Message = { readonly text: string; readonly like: ActionRef<typeof like> };

/** Compile-time checks; `yarn types` runs them, nothing calls them. */
function actionChecks(
  view: ViewFn,
  views: StoreView<FollowedRef, unknown, undefined, unknown>,
): void {
  equal<ActionArgsOf<typeof like>, { readonly message: string }>(true);
  equal<ActionArgsOf<typeof refresh>, undefined>(true);
  equal<ActionResultOf<typeof like>, Promise<void>>(true);
  equal<ActionArgsOf<Archive>, unknown>(true);

  // Any function or object that is not a view is an action, no declaration needed.
  const actions: readonly Action[] = [like, refresh, archive];
  // @ts-expect-error -- a view is not an action.
  const notAction: Action = views;
  // @ts-expect-error -- nor is a primitive.
  const primitive: Action = "archive";
  assert.ok([actions, notAction, primitive]);

  const message = view({
    resolve: (id: string, { action }): Message => {
      // `action` addresses an action, typed by the action's arguments.
      const liked = action(like, { message: id });
      equal<typeof liked, ActionRef<typeof like>>(true);
      const refreshed = action(refresh, undefined);
      equal<typeof refreshed, ActionRef<typeof refresh>>(true);
      const archived = action(archive, { chat: id });
      equal<typeof archived, ActionRef<Archive>>(true);
      const any: AnyActionRef = liked;
      // @ts-expect-error -- arguments follow the action's signature.
      action(like, { message: 1 });
      // @ts-expect-error -- an action ref is not a view ref.
      const notView: Ref = liked;
      assert.ok([any, notView, refreshed, archived]);
      return { text: id, like: liked };
    },
  });

  view({
    resolve: (id: string, { ref, action }) => {
      const made = ref(message, id);
      equal<typeof made, RefFor<typeof message>>(true);
      // @ts-expect-error -- `ref` takes views only.
      ref(like, { message: id });
      // @ts-expect-error -- `action` takes actions only.
      action(message, id);
      return made;
    },
  });

  // Across a federation boundary, an action ref is opaque, typed by its action and open inputs.
  equal<
    External<Message>,
    { readonly text: string; readonly like: ExternalActionRef<typeof like> }
  >(true);
  type Template = ActionRefTemplate<typeof like, { readonly message: string }>;
  equal<
    External<Template>,
    ExternalActionRef<typeof like, { readonly message: string }>
  >(true);
  const runTemplate = (template: External<Template>): void => {
    // @ts-expect-error -- a template does not pass for a bound ref: `message` is open.
    const bound: ExternalActionRef<typeof like> = template;
    assert.ok(bound);
  };
  assert.ok(runTemplate);

  view({
    resolve: (remote: ExternalRef<Message, Message>, { read }) => {
      const read1 = read(views, remote);
      const liked: ExternalActionRef<typeof like> = read1.like;
      // @ts-expect-error -- an action ref is never followed or read.
      read(views, liked);
      // @ts-expect-error -- an external action ref is not an external view ref.
      const notView: ExternalRef = liked;
      // @ts-expect-error -- it names one action only.
      const other: ExternalActionRef<typeof refresh> = liked;
      assert.ok([notView, other]);
      return read1.text;
    },
  });
}

describe("action refs", () => {
  it("are checked at compile time", () => {
    assert.equal(typeof actionChecks, "function");
  });
});
