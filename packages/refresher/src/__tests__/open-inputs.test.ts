import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  Action,
  ActionRef,
  ActionRefTemplate,
  AnyActionRef,
  AnyRef,
  AnyView,
  BindFn,
  ExternalRef,
  InputsOf,
  Ref,
  RefTemplate,
  ResolveContext,
  ViewFn,
} from "../index";

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y
  ? 1
  : 2
  ? true
  : false;
const equal = <X, Y>(same: Equal<X, Y>): boolean => same;

type Point = { readonly x: number; readonly y: number };
const send = (_args: {
  readonly chatId: string;
  readonly text: string;
}): void => {};
const move = (_args: {
  readonly from: Point;
  readonly to: Point;
  readonly tags: readonly string[];
}): void => {};

type Page = { readonly chatId: string; readonly first: number };

/** Compile-time checks; `yarn types` runs them, nothing calls them. */
function openInputsChecks(view: ViewFn): readonly AnyView[] {
  const access = {
    readable: true,
    referenceable: true,
    queryable: true,
  } as const;
  const messages = view({ access, resolve: (page: Page) => [page.chatId] });

  const chat = view({
    resolve: (chatId: string, { ref, action, input, read }: ResolveContext) => {
      // An input left open is typed by its position.
      const sendText = action(send, { chatId, text: input("text") });
      equal<
        typeof sendText,
        ActionRefTemplate<typeof send, { readonly text: string }>
      >(true);
      equal<InputsOf<typeof sendText>, { readonly text: string }>(true);

      // Bound in full: no inputs left open.
      const sent = action(send, { chatId, text: "hi" });
      equal<typeof sent, ActionRef<typeof send>>(true);
      equal<InputsOf<typeof sent>, {}>(true);

      // At any depth, and one name in several positions takes one value.
      const moved = action(move, {
        from: input("from"),
        to: { x: input("x"), y: input("x") },
        tags: [input("tag"), "pinned"],
      });
      equal<
        InputsOf<typeof moved>,
        { readonly from: Point; readonly x: number; readonly tag: string }
      >(true);

      // An input with a default is optional; the default must fit its position.
      const page = ref(messages, {
        chatId,
        first: input("first", { default: 20 }),
      });
      equal<
        typeof page,
        RefTemplate<string[], Page, { readonly first?: number }>
      >(true);
      // @ts-expect-error -- a default must fit its position.
      ref(messages, { chatId, first: input("first", { default: "20" }) });

      // @ts-expect-error -- the rest of the arguments still follow the signature.
      action(send, { chatId: 1, text: input("text") });
      // @ts-expect-error -- and take no keys the signature lacks.
      action(send, { chatId, text: input("text"), extra: 1 });
      // @ts-expect-error -- at any depth.
      action(move, { from: { x: 1, y: 1, z: 1 }, to: input("to"), tags: [] });

      // @ts-expect-error -- `read` takes no open inputs.
      read(messages, { chatId, first: input("first") });

      // A template is still any ref, but not a bound one.
      const any: AnyRef = page;
      const anyAction: AnyActionRef = sendText;
      // @ts-expect-error -- a template does not fit where a bound ref is required.
      const bound: Ref = page;
      // @ts-expect-error -- even when every input has a default.
      const boundAction: ActionRef<typeof send> = sendText;
      assert.ok([any, anyAction, bound, boundAction, sent]);
      return { send: sendText, page };
    },
  });

  return [messages, chat];
}

/** Branded arguments, as external refs, are leaves: compile-time checks too. */
function externalChecks(view: ViewFn): void {
  const access = { referenceable: true } as const;
  const remote = view({ access, resolve: (at: ExternalRef<Page>) => at });
  view({
    resolve: (at: ExternalRef<Page>, { ref, input }: ResolveContext) => {
      const given = ref(remote, at);
      equal<InputsOf<typeof given>, {}>(true);
      const left = ref(remote, input("at"));
      equal<InputsOf<typeof left>, { readonly at: ExternalRef<Page> }>(true);
      return [given, left];
    },
  });
}

/** Binding: compile-time checks too. */
function bindChecks(
  bind: BindFn,
  sendText: ActionRefTemplate<typeof send, { readonly text: string }>,
  page: RefTemplate<readonly string[], Page, { readonly first?: number }>,
  clash: ActionRefTemplate<typeof move, { readonly v: number & string }>,
  found: AnyRef,
  foundAction: AnyActionRef,
): void {
  const sent = bind(sendText, { text: "hello" });
  equal<typeof sent, ActionRef<typeof send>>(true);
  const paged = bind(page);
  equal<typeof paged, Ref<readonly string[], Page>>(true);
  bind(page, { first: 50 });

  // Values for inputs a template does not leave open are ignored.
  const values = { text: "hello", search: "refresher" };
  bind(sendText, values);

  // @ts-expect-error -- an input without a default needs a value.
  bind(sendText);
  // @ts-expect-error -- of its position's type.
  bind(sendText, { text: 1 });
  // @ts-expect-error -- one name in positions of different types needs a value of both.
  bind(clash, { v: 1 });

  // A ref found in data leaves inputs nothing knows: it takes any values.
  const followed = bind(found, { first: 10 });
  equal<typeof followed, Ref>(true);
  const run = bind(foundAction);
  equal<typeof run, ActionRef<Action>>(true);

  // A ref leaving fewer inputs open fits where more are supplied.
  const supplied: RefTemplate<
    readonly string[],
    Page,
    { readonly first?: number; readonly last: number }
  > = page;
  const bound: Ref<readonly string[], Page> = paged;
  const template: RefTemplate<
    readonly string[],
    Page,
    { readonly first?: number }
  > = bound;
  // @ts-expect-error -- but not where fewer are, or other types.
  const mistyped: RefTemplate<
    readonly string[],
    Page,
    { readonly first?: string }
  > = page;
  assert.ok([supplied, template, mistyped]);
}

describe("open inputs", () => {
  it("are checked at compile time", () => {
    assert.equal(typeof openInputsChecks, "function");
    assert.equal(typeof bindChecks, "function");
    assert.equal(typeof externalChecks, "function");
  });
});
