import { gql } from "@apollo/client";
import type { Cache, DocumentNode } from "@apollo/client";
import { ForestRun } from "../ForestRun";
import type { CacheConfig } from "../cache/types";

const optimized = (config: CacheConfig = {}) =>
  new ForestRun({ ...config, optimizeIncompleteChunkInvalidation: true });

// Mirrors Apollo QueryInfo: queries are watched (and diffed) while their requests are in flight
const watchQuery = (
  cache: ForestRun,
  query: DocumentNode,
  variables?: Record<string, unknown>,
) => {
  const callback = jest.fn();
  const watch: Cache.WatchOptions = {
    query,
    variables,
    optimistic: true,
    returnPartialData: true,
    callback: (diff) => {
      watch.lastDiff = diff;
      callback(diff);
    },
  };
  cache.watch(watch);
  watch.lastDiff = cache.diff(watch);
  return { watch, callback };
};

const messageQuery = (field: string) => gql`
  query Message_${field}($id: ID!) {
    message(id: $id) {
      id
      ${field}
    }
  }
`;

const message = (id: string, fields: Record<string, unknown>) => ({
  message: { __typename: "Message", id, ...fields },
});
const messages = (...items: Record<string, unknown>[]) => ({
  messages: items.map((item) => ({ __typename: "Message", ...item })),
});

const A = messageQuery("a");
const B = messageQuery("b");
const C = messageQuery("c");
const variables = { id: "1" };

describe("optimizeIncompleteChunkInvalidation: pending partial watches", () => {
  it("are not re-hydrated or re-notified by sibling writes with unrelated fields of the same node", () => {
    const cache = optimized();
    const a = watchQuery(cache, A, variables);
    watchQuery(cache, B, variables);
    watchQuery(cache, C, variables);

    cache.write({ query: B, variables, result: message("1", { b: "b" }) });
    const partial = cache.diff(a.watch);
    expect(partial.complete).toBe(false);
    a.callback.mockClear();

    cache.write({ query: C, variables, result: message("1", { c: "c" }) });

    expect(a.callback).not.toHaveBeenCalled();
    expect(cache.diff(a.watch).result).toBe(partial.result);

    cache.write({ query: A, variables, result: message("1", { a: "a" }) });

    expect(a.callback).toHaveBeenCalledTimes(1);
    expect(cache.diff(a.watch)).toMatchObject({
      complete: true,
      result: message("1", { a: "a" }),
    });
  });

  it("match missing fields by arguments, regardless of aliases", () => {
    const Html = gql`
      query Html {
        message(id: "1") {
          id
          text(format: "html")
        }
      }
    `;
    const Plain = gql`
      query Plain {
        message(id: "1") {
          id
          text(format: "plain")
        }
      }
    `;
    const PlainWithC = gql`
      query PlainWithC {
        message(id: "1") {
          id
          c
          text(format: "plain")
        }
      }
    `;
    const AliasedHtml = gql`
      query AliasedHtml {
        message(id: "1") {
          id
          html: text(format: "html")
        }
      }
    `;
    const cache = optimized();
    const html = watchQuery(cache, Html);
    watchQuery(cache, PlainWithC);
    watchQuery(cache, AliasedHtml);

    cache.write({ query: Plain, result: message("1", { text: "plain" }) });
    const partial = cache.diff(html.watch);
    expect(partial.complete).toBe(false);
    html.callback.mockClear();

    // Brings `text(format: "plain")` again (unchanged) along with the changed `c`
    cache.write({
      query: PlainWithC,
      result: message("1", { c: "c", text: "plain" }),
    });

    expect(html.callback).not.toHaveBeenCalled();
    expect(cache.diff(html.watch).result).toBe(partial.result);

    cache.write({
      query: AliasedHtml,
      result: message("1", { html: "<b>html</b>" }),
    });

    expect(html.callback).toHaveBeenCalledTimes(1);
    expect(cache.diff(html.watch)).toMatchObject({
      complete: true,
      result: message("1", { text: "<b>html</b>" }),
    });
  });
});

type ParityEnv = {
  cache: ForestRun;
  watch: (
    name: string,
    query: DocumentNode,
    options?: Partial<Cache.WatchOptions>,
  ) => void;
  step: (name: string, fn: () => void) => void;
};

/**
 * Runs the same scenario with `optimizeIncompleteChunkInvalidation` disabled and enabled,
 * and expects identical notifications and identical results of all watches after every step.
 *
 * Watches use `returnPartialData: false` (Apollo default), so redundant re-hydrations
 * of partial results do not produce notifications (and notifications must match exactly).
 */
function expectParity(config: CacheConfig, scenario: (env: ParityEnv) => void) {
  const clone = (value: unknown) => JSON.parse(JSON.stringify(value ?? null));
  const run = (optimizeIncompleteChunkInvalidation: boolean) => {
    const cache = new ForestRun({
      ...config,
      optimizeIncompleteChunkInvalidation,
    });
    const log: unknown[] = [];
    const watches: [string, Cache.WatchOptions][] = [];
    const snapshot = () =>
      Object.fromEntries(
        watches.map(([name, watch]) => {
          const { complete, result } = cache.diff({
            ...watch,
            returnPartialData: true,
          });
          return [name, { complete, result: clone(result) }];
        }),
      );
    const env: ParityEnv = {
      cache,
      watch(name, query, options) {
        const watch: Cache.WatchOptions = {
          query,
          optimistic: true,
          ...options,
          callback: (diff) => {
            log.push({ notify: name, ...clone(diff) });
          },
        };
        cache.watch(watch);
        cache.diff(watch); // like QueryInfo
        watches.push([name, watch]);
      },
      step(name, fn) {
        fn();
        log.push({ step: name, watches: snapshot() });
      },
    };
    scenario(env);
    return log;
  };
  const expected = run(false);
  const actual = run(true);
  expect(actual).toEqual(expected);
  return actual as Array<{
    step?: string;
    notify?: string;
    watches?: Record<string, { complete: boolean; result: any }>;
  }>;
}

const finalState = (log: ReturnType<typeof expectParity>) =>
  log.filter((entry) => entry.step).pop()?.watches;

describe("optimizeIncompleteChunkInvalidation: parity with conservative invalidation", () => {
  const List = (fields: string) => gql`
    query List_${fields.replace(/\W+/g, "_")} {
      messages {
        id
        ${fields}
      }
    }
  `;

  it("pending sibling watches with sequential responses", () => {
    const log = expectParity({}, ({ cache, watch, step }) => {
      watch("A", A, { variables });
      watch("B", B, { variables });
      watch("C", C, { variables });
      for (const [query, fields] of [
        [B, { b: "b" }],
        [C, { c: "c" }],
        [A, { a: "a" }],
      ] as const) {
        step(`write ${Object.keys(fields)}`, () =>
          cache.write({ query, variables, result: message("1", fields) }),
        );
      }
    });
    expect(finalState(log)).toMatchObject({
      A: { complete: true },
      B: { complete: true },
      C: { complete: true },
    });
  });

  it("read policy of a missing field reading other nodes", () => {
    const AuthorName = gql`
      query AuthorName {
        message(id: "1") {
          id
          authorName
        }
      }
    `;
    const User = gql`
      query User {
        user(id: "u1") {
          id
          name
        }
      }
    `;
    const config: CacheConfig = {
      typePolicies: {
        Message: {
          fields: {
            authorName: {
              read: (_, { readField, toReference }) =>
                readField<string>(
                  "name",
                  toReference({ __typename: "User", id: "u1" }),
                ),
            },
          },
        },
      },
    };
    const log = expectParity(config, ({ cache, watch, step }) => {
      watch("AuthorName", AuthorName);
      watch("B", B, { variables });
      watch("C", C, { variables });
      step("write B", () =>
        cache.write({ query: B, variables, result: message("1", { b: "b" }) }),
      );
      step("write User", () =>
        cache.write({
          query: User,
          result: { user: { __typename: "User", id: "u1", name: "Bob" } },
        }),
      );
      step("write C (same node, unrelated field)", () =>
        cache.write({ query: C, variables, result: message("1", { c: "c" }) }),
      );
    });
    expect(finalState(log)?.AuthorName).toEqual({
      complete: true,
      result: message("1", { authorName: "Bob" }),
    });
  });

  it("read policy of a sibling field reading unselected fields of the same node", () => {
    const TitleAndA = gql`
      query TitleAndA {
        message(id: "1") {
          id
          title
          a
        }
      }
    `;
    const RawTitle = messageQuery("rawTitle");
    const config: CacheConfig = {
      typePolicies: {
        Message: {
          fields: {
            title: {
              read: (_, { readField }) =>
                readField<string>("rawTitle")?.toUpperCase() ?? "untitled",
            },
          },
        },
      },
    };
    const log = expectParity(config, ({ cache, watch, step }) => {
      watch("TitleAndA", TitleAndA, { returnPartialData: true });
      watch("RawTitle", RawTitle, { variables });
      watch("B", B, { variables });
      step("write B", () =>
        cache.write({ query: B, variables, result: message("1", { b: "b" }) }),
      );
      step("write RawTitle (unselected by TitleAndA)", () =>
        cache.write({
          query: RawTitle,
          variables,
          result: message("1", { rawTitle: "hello" }),
        }),
      );
      step("write A", () =>
        cache.write({ query: A, variables, result: message("1", { a: "a" }) }),
      );
    });
    const afterRawTitle = log.find(
      (entry) => entry.step === "write RawTitle (unselected by TitleAndA)",
    );
    expect(afterRawTitle?.watches?.TitleAndA).toEqual({
      complete: false,
      result: message("1", { title: "HELLO" }),
    });
    expect(finalState(log)?.TitleAndA).toEqual({
      complete: true,
      result: message("1", { title: "HELLO", a: "a" }),
    });
  });

  it("read policies on a node with multiple chunks and missing fields", () => {
    const TitleAndA = gql`
      query TitleAndA {
        m1: message(id: "1") {
          id
          title
        }
        m2: message(id: "1") {
          id
          a
        }
      }
    `;
    const RawTitle = messageQuery("rawTitle");
    const config: CacheConfig = {
      typePolicies: {
        Message: {
          fields: {
            title: {
              read: (_, { readField }) =>
                readField<string>("rawTitle") ?? "untitled",
            },
          },
        },
      },
    };
    const log = expectParity(config, ({ cache, watch, step }) => {
      watch("TitleAndA", TitleAndA, { returnPartialData: true });
      watch("RawTitle", RawTitle, { variables });
      for (const rawTitle of ["one", "two"]) {
        step(`write rawTitle ${rawTitle}`, () =>
          cache.write({
            query: RawTitle,
            variables,
            result: message("1", { rawTitle }),
          }),
        );
      }
    });
    expect(finalState(log)?.TitleAndA).toEqual({
      complete: false,
      result: {
        m1: { __typename: "Message", id: "1", title: "two" },
        m2: { __typename: "Message", id: "1" },
      },
    });
  });

  it("cache redirects", () => {
    const Text = gql`
      query Text {
        message(id: "1") {
          id
          text
        }
      }
    `;
    const config: CacheConfig = {
      typePolicies: {
        Query: {
          fields: {
            message: {
              read: (_, { args, toReference }) =>
                toReference({ __typename: "Message", id: args?.id }),
            },
          },
        },
      },
    };
    const log = expectParity(config, ({ cache, watch, step }) => {
      watch("Text", Text);
      watch("B", B, { variables });
      watch("ListB", List("b"));
      watch("ListC", List("c"));
      step("write list with b", () =>
        cache.write({
          query: List("b"),
          result: messages({ id: "1", b: "b" }),
        }),
      );
      step("write list with c (unrelated)", () =>
        cache.write({
          query: List("c"),
          result: messages({ id: "1", c: "c" }),
        }),
      );
      step("write B (unrelated)", () =>
        cache.write({ query: B, variables, result: message("1", { b: "b2" }) }),
      );
      step("write list with text", () =>
        cache.write({
          query: List("text"),
          result: messages({ id: "1", text: "text" }),
        }),
      );
    });
    expect(finalState(log)?.Text).toEqual({
      complete: true,
      result: message("1", { text: "text" }),
    });
  });

  it("cache redirects to dangling references", () => {
    const Text = gql`
      query Text {
        message(id: "2") {
          id
          text
        }
      }
    `;
    const config: CacheConfig = {
      typePolicies: {
        Query: {
          fields: {
            message: {
              read: (_, { args, toReference }) =>
                toReference({ __typename: "Message", id: args?.id }),
            },
          },
        },
      },
    };
    const log = expectParity(config, ({ cache, watch, step }) => {
      watch("Text", Text, { returnPartialData: true });
      step("write list with dangling node (unrelated field)", () =>
        cache.write({
          query: List("b"),
          result: messages({ id: "2", b: "b" }),
        }),
      );
      step("write list with c (unrelated)", () =>
        cache.write({
          query: List("c"),
          result: messages({ id: "2", c: "c" }),
        }),
      );
      step("write list with text", () =>
        cache.write({
          query: List("text"),
          result: messages({ id: "2", text: "text" }),
        }),
      );
    });
    expect(finalState(log)?.Text).toEqual({
      complete: true,
      result: message("2", { text: "text" }),
    });
  });

  it("optimistic layers", () => {
    const log = expectParity({}, ({ cache, watch, step }) => {
      watch("A", A, { variables });
      watch("A (non-optimistic)", A, { variables, optimistic: false });
      watch("B", B, { variables });
      watch("C", C, { variables });
      step("optimistic B", () =>
        cache.recordOptimisticTransaction((c) => {
          c.write({ query: B, variables, result: message("1", { b: "b" }) });
        }, "opt1"),
      );
      step("optimistic C (unrelated)", () =>
        cache.recordOptimisticTransaction((c) => {
          c.write({ query: C, variables, result: message("1", { c: "c" }) });
        }, "opt2"),
      );
      step("optimistic A", () =>
        cache.recordOptimisticTransaction((c) => {
          c.write({
            query: A,
            variables,
            result: message("1", { a: "a-opt" }),
          });
        }, "opt3"),
      );
      step("real C (unrelated)", () =>
        cache.write({ query: C, variables, result: message("1", { c: "c2" }) }),
      );
      step("remove opt3", () => cache.removeOptimistic("opt3"));
      step("real B (unrelated)", () =>
        cache.write({ query: B, variables, result: message("1", { b: "b2" }) }),
      );
      step("real A", () =>
        cache.write({ query: A, variables, result: message("1", { a: "a" }) }),
      );
      step("remove opt1, opt2", () => {
        cache.removeOptimistic("opt1");
        cache.removeOptimistic("opt2");
      });
    });
    expect(finalState(log)).toMatchObject({
      A: { complete: true, result: message("1", { a: "a" }) },
      "A (non-optimistic)": { complete: true },
    });
  });

  it("mutation results replacing optimistic responses in a batch", () => {
    const log = expectParity({}, ({ cache, watch, step }) => {
      watch("A", A, { variables });
      watch("B", B, { variables });
      watch("C", C, { variables });
      step("optimistic A", () =>
        cache.recordOptimisticTransaction((c) => {
          c.write({
            query: A,
            variables,
            result: message("1", { a: "a-opt" }),
          });
        }, "m1"),
      );
      step("mutation result (unrelated) + remove optimistic", () =>
        cache.batch({
          update: (c) =>
            c.write({ query: C, variables, result: message("1", { c: "c" }) }),
          optimistic: false,
          removeOptimistic: "m1",
        }),
      );
      step("optimistic write inside batch", () =>
        cache.batch({
          update: (c) =>
            c.write({ query: B, variables, result: message("1", { b: "b" }) }),
          optimistic: "m2",
        }),
      );
      step("real A", () =>
        cache.write({ query: A, variables, result: message("1", { a: "a" }) }),
      );
    });
    expect(finalState(log)?.A).toEqual({
      complete: true,
      result: message("1", { a: "a" }),
    });
  });

  it("nested nodes with missing fields", () => {
    const AuthorName = gql`
      query AuthorName {
        message(id: "1") {
          id
          author {
            id
            name
          }
        }
      }
    `;
    const AuthorEmail = gql`
      query AuthorEmail {
        message(id: "1") {
          id
          author {
            id
            email
          }
        }
      }
    `;
    const User = (field: string) => gql`
      query User_${field} {
        user(id: "u1") {
          id
          ${field}
        }
      }
    `;
    const user = (fields: Record<string, unknown>) => ({
      __typename: "User",
      id: "u1",
      ...fields,
    });
    const log = expectParity({}, ({ cache, watch, step }) => {
      watch("AuthorName", AuthorName);
      watch("AuthorEmail", AuthorEmail);
      watch("UserAvatar", User("avatar"));
      step("write AuthorEmail", () =>
        cache.write({
          query: AuthorEmail,
          result: message("1", { author: user({ email: "e" }) }),
        }),
      );
      step("write UserAvatar (unrelated)", () =>
        cache.write({
          query: User("avatar"),
          result: { user: user({ avatar: "x" }) },
        }),
      );
      step("write UserName", () =>
        cache.write({
          query: User("name"),
          result: { user: user({ name: "n" }) },
        }),
      );
    });
    expect(finalState(log)?.AuthorName).toEqual({
      complete: true,
      result: message("1", { author: user({ name: "n" }) }),
    });
  });

  it("field arguments with keyArgs", () => {
    const Text = (format: string) => gql`
      query Text_${format} {
        message(id: "1") {
          id
          text(format: "${format}")
        }
      }
    `;
    const config: CacheConfig = {
      typePolicies: { Message: { fields: { text: { keyArgs: false } } } },
    };
    const log = expectParity(config, ({ cache, watch, step }) => {
      watch("Html", Text("html"));
      watch("B", B, { variables });
      step("write B", () =>
        cache.write({ query: B, variables, result: message("1", { b: "b" }) }),
      );
      step("write plain text (same key)", () =>
        cache.write({
          query: Text("plain"),
          result: message("1", { text: "plain" }),
        }),
      );
    });
    expect(finalState(log)?.Html).toEqual({
      complete: true,
      result: message("1", { text: "plain" }),
    });
  });

  it("fragment writes with custom ids", () => {
    const fragment = (field: string) => gql`
      fragment Message_${field} on Message {
        ${field}
      }
    `;
    const log = expectParity({}, ({ cache, watch, step }) => {
      watch("A", A, { variables });
      watch("B", B, { variables });
      step("write B", () =>
        cache.write({ query: B, variables, result: message("1", { b: "b" }) }),
      );
      step("write fragment c (unrelated)", () =>
        cache.writeFragment({
          id: "Message:1",
          fragment: fragment("c"),
          data: { __typename: "Message", c: "c" },
        }),
      );
      step("write fragment a", () =>
        cache.writeFragment({
          id: "Message:1",
          fragment: fragment("a"),
          data: { __typename: "Message", a: "a" },
        }),
      );
    });
    expect(finalState(log)?.A).toEqual({
      complete: true,
      result: message("1", { a: "a" }),
    });
  });

  it("evict and modify (no incoming result)", () => {
    const log = expectParity({}, ({ cache, watch, step }) => {
      watch("A", A, { variables });
      watch("C", C, { variables });
      step("write A", () =>
        cache.write({ query: A, variables, result: message("1", { a: "a" }) }),
      );
      step("evict a", () => cache.evict({ id: "Message:1", fieldName: "a" }));
      step("write C (unrelated)", () =>
        cache.write({ query: C, variables, result: message("1", { c: "c" }) }),
      );
      step("modify a", () =>
        cache.modify({ id: "Message:1", fields: { a: () => "a2" } }),
      );
      step("write A", () =>
        cache.write({ query: A, variables, result: message("1", { a: "a3" }) }),
      );
    });
    expect(finalState(log)?.A).toEqual({
      complete: true,
      result: message("1", { a: "a3" }),
    });
  });
});
