import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  AnyView,
  External,
  ExternalRef,
  ExternalRefFor,
  ExternalViewFn,
  FollowedRef,
  PromiseOrValue,
  Ref,
  StoreView,
  ViewFn,
} from "../index";

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y
  ? 1
  : 2
  ? true
  : false;
const equal = <X, Y>(same: Equal<X, Y>): boolean => same;

type Author = { readonly name: string };
type Message = { readonly text: string; readonly author: Ref<Author, string> };

/** Compile-time checks; `yarn types` runs them, nothing calls them. */
function externalChecks(
  view: ViewFn,
  external: ExternalViewFn,
  views: StoreView<FollowedRef, unknown, undefined, unknown>,
  keyed: StoreView<ExternalRef<Author>, number, undefined, number>,
): void {
  const message = view({
    resolve: (id: string): Message => ({ text: id, author: null! }),
  });
  const plain = view({ resolve: (id: string) => id.length });
  const readable = view({
    access: { readable: true },
    resolve: (id: string) => id.length,
  });
  const messages = external<typeof message, Message | Author>("message");
  const bare = external<typeof message>("message");

  equal<
    External<Message>,
    { readonly text: string; readonly author: ExternalRef<Author> }
  >(true);
  equal<
    External<Message, Author>,
    { readonly text: string; readonly author: ExternalRef<Author, Author> }
  >(true);

  view({
    resolve: (
      ref: ExternalRefFor<typeof message, Message | Author>,
      { read },
    ) => {
      // A view keyed by followed refs, its result left `unknown`, answers what the ref names.
      const read1 = read(views, ref);
      equal<typeof read1, External<Message, Message | Author>>(true);
      const author = read(views, read1.author);
      equal<typeof author, Author>(true);

      // An external view answers external refs where its result holds refs.
      const read2 = read(messages, "m1");
      equal<typeof read2, PromiseOrValue<External<Message, Message | Author>>>(
        true,
      );

      // A view keyed by external refs that declares its result answers its own result.
      const read3 = read(keyed, read1.author);
      equal<typeof read3, number>(true);
      equal<ReturnType<typeof read<typeof keyed>>, number>(true);

      // @ts-expect-error -- an external ref is not a plain string.
      read(views, "m1");
      // @ts-expect-error -- the view's key names another result.
      read(keyed, ref);
      // @ts-expect-error -- only a readable view may be inlined.
      read(plain, "m1");
      // @ts-expect-error -- arguments follow the view's signature.
      read(readable, 1);
      return read(readable, author.name);
    },
  });

  view({
    resolve: async (id: string, { read }) => {
      const { author } = await read(bare, id);
      // A ref its query did not follow is passed on, or keys a view that declares its result.
      const passed: ExternalRef<Author> = author;
      const keyedRead = read(keyed, author);
      equal<typeof keyedRead, number>(true);
      // @ts-expect-error -- its query did not follow it.
      read(views, author);
      return passed;
    },
  });

  // A ref from a query that followed more fits where less is needed, and not the reverse.
  const more = null! as ExternalRef<Message, Message | Author>;
  const less: ExternalRef<Message, Message> = more;
  const any: ExternalRef<Message> = less;
  const every = null! as ExternalRef<Message, unknown>;
  const all: ExternalRef<Message, Message | Author> = every;
  // @ts-expect-error -- followed too little.
  const tooLittle: ExternalRef<Message, Message | Author> = less;
  // @ts-expect-error -- not followed at all.
  const unfollowed: ExternalRef<Message, Message> = any;

  const declared: readonly AnyView[] = [
    message,
    plain,
    readable,
    messages,
    bare,
    views,
    keyed,
  ];
  assert.ok([declared, all, tooLittle, unfollowed]);
}

describe("external refs", () => {
  it("are checked at compile time", () => {
    assert.equal(typeof externalChecks, "function");
  });
});
