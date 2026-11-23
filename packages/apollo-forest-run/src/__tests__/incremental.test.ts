import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  Observable,
  gql,
} from "@apollo/client";
import type { FetchResult } from "@apollo/client";
import { GraphQLError, parse } from "graphql";
import {
  executeWithSchema,
  isIncrementalExecutionResult,
} from "@graphitation/supermassive";
import { ForestRun } from "../ForestRun";
import type { ExecutionPatchResult as IncrementalResponse } from "@apollo/client/link/core/types";

const query = gql`
  query {
    messages {
      id
      text
      ... @defer {
        name
      }
    }
  }
`;
const first = { __typename: "Message", id: "1", text: "original" };
const second = { __typename: "Message", id: "2", text: "new", name: "second" };
function writer(cache: ForestRun, document = query, token = {}) {
  return (result: IncrementalResponse) => {
    if (result.data && result.pending) {
      cache.writeInitialData({
        query: document,
        token,
        data: result.data,
        pending: result.pending,
      });
    } else if (result.incremental) {
      cache.writeIncrementalData({
        query: document,
        token,
        patches: result.incremental,
      });
    }
    if (!result.hasNext) cache.releaseIncremental(token);
  };
}
const initial: IncrementalResponse = {
  data: { messages: [first] },
  pending: [{ path: ["messages", 0] }],
  hasNext: true,
};
const final: IncrementalResponse = {
  incremental: [{ path: ["messages", 0], data: { name: "Alice" } }],
  hasNext: false,
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function connect(cache: ForestRun | InMemoryCache, queryDeduplication = true) {
  const sources: ((result: FetchResult) => void)[] = [];
  const request = jest.fn(
    () =>
      new Observable<FetchResult>((observer) => {
        sources.push((result) => observer.next({ ...result }));
      }),
  );
  const client = new ApolloClient<ReturnType<typeof cache.extract>>({
    cache,
    link: new ApolloLink(request),
    queryDeduplication,
  });
  const send = (result: FetchResult) => sources[sources.length - 1](result);
  return { client, request, sources, send };
}

function supermassiveLink(name: Promise<string> | (() => never)) {
  return new ApolloLink(
    (operation) =>
      new Observable((observer) => {
        (async () => {
          const execution = await executeWithSchema({
            definitions: parse(
              "type Query { messages: [Message!]! } type Message { id: ID!, text: String, name: String! }",
            ),
            document: operation.query,
            rootValue: { messages: [first] },
            resolvers: {
              Message: { name: typeof name === "function" ? name : () => name },
            },
          });
          if (!isIncrementalExecutionResult(execution))
            throw new Error("Expected deferred execution");
          observer.next(execution.initialResult);
          for await (const payload of execution.subsequentResults) {
            observer.next(payload);
          }
          observer.complete();
        })().catch((error) => observer.error(error));
      }),
  );
}

describe("Apollo integration", () => {
  test("keeps stock writes when the cache has no writeIncrementalData", async () => {
    const cache = Object.assign(new InMemoryCache(), {
      writeInitialData: jest.fn(),
    });
    const { client, send } = connect(cache);
    const sub = client
      .watchQuery({ query, fetchPolicy: "network-only" })
      .subscribe(() => undefined);
    try {
      send(initial);
      send(final);
      await flush();
      expect(cache.readQuery({ query })).toEqual({
        messages: [{ ...first, name: "Alice" }],
      });
      expect(cache.writeInitialData).not.toHaveBeenCalled();
    } finally {
      sub.unsubscribe();
      client.stop();
    }
  });

  test.each(["network-only", "no-cache"] as const)(
    "merges Supermassive patches into original targets (%s)",
    async (fetchPolicy) => {
      let resolveName!: (name: string) => void;
      const cache = new ForestRun();
      const client = new ApolloClient({
        cache,
        link: supermassiveLink(new Promise((done) => (resolveName = done))),
      });
      const observable = client.watchQuery<{ messages: unknown[] }>({
        query,
        fetchPolicy,
      });
      const sub = observable.subscribe(() => undefined);
      try {
        while (!observable.getCurrentResult().data?.messages) await flush();
        cache.writeQuery({ query, data: { messages: [second, first] } });
        resolveName("Alice");
        while (observable.getCurrentResult().partial) await flush();
        await flush();
        expect(observable.getCurrentResult().data.messages).toEqual(
          fetchPolicy === "no-cache"
            ? [{ ...first, name: "Alice" }]
            : [second, { ...first, name: "Alice" }],
        );
        if (fetchPolicy !== "no-cache") {
          expect(cache.readQuery({ query })).toEqual({
            messages: [second, { ...first, name: "Alice" }],
          });
        }
      } finally {
        sub.unsubscribe();
        client.stop();
      }
    },
  );

  test.each(["all", "ignore", "none"] as const)(
    "handles failed Supermassive deferred fragments with errorPolicy=%s",
    async (errorPolicy) => {
      const cache = new ForestRun();
      const client = new ApolloClient({
        cache,
        link: supermassiveLink(() => {
          throw new Error("name failed");
        }),
      });
      const observable = client.watchQuery<{ messages: unknown[] }>({
        query,
        fetchPolicy: "network-only",
        errorPolicy,
      });
      let error: Error | undefined;
      const sub = observable.subscribe({
        error: (e) => (error = e),
      });
      try {
        for (let i = 0; i < 20; i++) await flush();
        if (errorPolicy === "none") {
          expect(error?.message).toContain("name failed");
        } else {
          const result = observable.getCurrentResult();
          expect(result.data.messages).toEqual([null]);
          expect(cache.readQuery({ query, returnPartialData: true })).toEqual({
            messages: [first],
          });
          expect(result.errors?.[0]?.message).toBe(
            errorPolicy === "all" ? "name failed" : undefined,
          );
        }
      } finally {
        sub.unsubscribe();
        client.stop();
      }
    },
  );

  test("applies a multi-patch frame in one transaction", async () => {
    const cache = new ForestRun();
    const { client, send } = connect(cache);
    const other = { ...first, id: "2" };
    const observable = client.watchQuery<{ messages: unknown[] }>({
      query,
      fetchPolicy: "network-only",
    });
    const sub = observable.subscribe(() => undefined);
    send({
      data: { messages: [first, other] },
      pending: [{ path: ["messages", 0] }, { path: ["messages", 1] }],
      hasNext: true,
    });
    await flush();
    const notify = jest.fn();
    const unwatch = cache.watch({ query, optimistic: false, callback: notify });
    const transaction = jest.spyOn(cache, "performTransaction");
    const write = jest.spyOn(cache, "writeIncrementalData");
    const patches = [
      { path: ["messages", 0], data: { name: "Alice" } },
      { path: ["messages", 1], data: { name: "Bob" } },
    ];
    try {
      send({ incremental: patches, hasNext: false });
      await flush();
      const expected = {
        messages: [
          { ...first, name: "Alice" },
          { ...other, name: "Bob" },
        ],
      };
      expect(observable.getCurrentResult().data).toEqual(expected);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(write).toHaveBeenCalledTimes(1);
      expect(write.mock.calls[0][0]).toMatchObject({ patches });
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify.mock.calls[0][0].result).toEqual(expected);
    } finally {
      transaction.mockRestore();
      write.mockRestore();
      unwatch();
      sub.unsubscribe();
      client.stop();
    }
  });

  test("deduplicated queries write once per accepted error policy", async () => {
    const name = jest.fn((_existing, incoming) => incoming);
    const cache = new ForestRun({
      typePolicies: { Message: { fields: { name: { merge: name } } } },
    });
    const { client, request, send } = connect(cache);
    let failed: Error | undefined;
    const strict = client
      .watchQuery({ query, fetchPolicy: "network-only", errorPolicy: "none" })
      .subscribe({ error: (error) => (failed = error) });
    const observable = client.watchQuery<{ messages: unknown[] }>({
      query,
      fetchPolicy: "network-only",
      errorPolicy: "all",
    });
    const tolerant = observable.subscribe(() => undefined);
    expect(request).toHaveBeenCalledTimes(1);
    send(initial);
    await flush();
    send({
      hasNext: false,
      incremental: [
        {
          path: ["messages", 0],
          data: { name: "Alice" },
          errors: [new GraphQLError("partial")],
        },
      ],
    });
    await flush();
    expect(failed?.message).toContain("partial");
    const result = observable.getCurrentResult();
    expect(result.data.messages).toEqual([{ ...first, name: "Alice" }]);
    expect(result.errors?.[0].message).toBe("partial");
    expect(name).toHaveBeenCalledTimes(1);
    strict.unsubscribe();
    tolerant.unsubscribe();
    client.stop();
  });

  test("refetch replaces the previous execution", async () => {
    const cache = new ForestRun();
    const { client, sources } = connect(cache, false);
    const observable = client.watchQuery<{ messages: unknown[] }>({
      query,
      fetchPolicy: "network-only",
    });
    const sub = observable.subscribe(() => undefined);
    sources[0](initial);
    await flush();
    void observable.refetch();
    expect(sources).toHaveLength(2);
    sources[1]({ ...initial, data: { messages: [{ ...first, id: "2" }] } });
    sources[0](final);
    sources[1](final);
    await flush();
    expect(observable.getCurrentResult().data.messages).toEqual([
      { ...first, id: "2", name: "Alice" },
    ]);
    expect(cache.readQuery({ query })).toEqual({
      messages: [{ ...first, id: "2", name: "Alice" }],
    });
    sub.unsubscribe();
    client.stop();
  });

  test("ignores a replayed initial response even after an unrelated eviction", async () => {
    const cache = new ForestRun();
    const { client, request, send } = connect(cache);
    cache.writeQuery({
      query: gql`
        {
          unrelated
        }
      `,
      data: { unrelated: true },
    });
    const observable = client.watchQuery({
      query,
      fetchPolicy: "network-only",
    });
    const sub = observable.subscribe(() => undefined);
    send(initial);
    await flush();
    const unnamed = { __typename: "Message", id: "2", text: "new" };
    cache.batch({
      update(cache) {
        cache.evict({ fieldName: "unrelated" });
        cache.writeQuery({
          query: gql`
            query {
              messages {
                id
                text
              }
            }
          `,
          data: { messages: [unnamed, first] },
        });
      },
    });
    await flush();
    send(final);
    await flush();
    expect(request).toHaveBeenCalledTimes(1);
    expect(cache.readQuery({ query, returnPartialData: true })).toEqual({
      messages: [unnamed, { ...first, name: "Alice" }],
    });
    sub.unsubscribe();
    client.stop();
  });

  test.each(["network-only", "cache-and-network"] as const)(
    "a late %s watcher shares the original patch target without rewriting it",
    async (fetchPolicy) => {
      const merge = jest.fn((_existing, incoming) => incoming);
      const cache = new ForestRun({
        typePolicies: { Message: { fields: { name: { merge } } } },
      });
      const { client, request, send } = connect(cache);
      const watch = () =>
        client.watchQuery({ query, fetchPolicy }).subscribe(() => undefined);

      try {
        const firstWatcher = watch();
        send(initial);
        await flush();

        cache.writeQuery({ query, data: { messages: [second, first] } });
        await flush();
        merge.mockClear();
        send({ ...final, hasNext: true });
        await flush();
        const expected = { messages: [second, { ...first, name: "Alice" }] };
        expect(cache.readQuery({ query })).toEqual(expected);

        // No new network payload: Apollo gives the late watcher the last patch.
        watch();
        await flush();
        expect(request).toHaveBeenCalledTimes(1);
        expect(cache.readQuery({ query })).toEqual(expected);
        expect(merge).toHaveBeenCalledTimes(1);

        firstWatcher.unsubscribe();
        send({
          ...final,
          incremental: [{ path: ["messages", 0], data: { name: "Bob" } }],
        });
        await flush();
        expect(cache.readQuery({ query })).toEqual({
          messages: [second, { ...first, name: "Bob" }],
        });
        expect(merge).toHaveBeenCalledTimes(2);
      } finally {
        client.stop();
      }
    },
  );

  test("a late cache writer can join a request started with no-cache", async () => {
    const cache = new ForestRun();
    const { client, request, send } = connect(cache);
    try {
      client
        .watchQuery({ query, fetchPolicy: "no-cache" })
        .subscribe(() => undefined);
      send(initial);
      send({ ...final, hasNext: true });
      await flush();
      expect(cache.readQuery({ query })).toBeNull();

      client
        .watchQuery({ query, fetchPolicy: "network-only" })
        .subscribe(() => undefined);
      await flush();
      expect(request).toHaveBeenCalledTimes(1);
      expect(cache.readQuery({ query })).toEqual({
        messages: [{ ...first, name: "Alice" }],
      });
    } finally {
      client.stop();
    }
  });

  test("a cancelled request cannot update the cache", async () => {
    const cache = new ForestRun();
    const { client, send } = connect(cache);
    const sub = client
      .watchQuery({ query, fetchPolicy: "network-only" })
      .subscribe(() => undefined);
    send(initial);
    await flush();
    sub.unsubscribe();
    send(final);
    await flush();
    expect(cache.readQuery({ query, returnPartialData: true })).toEqual({
      messages: [first],
    });
    client.stop();
  });
});
describe("server-announced incremental writes", () => {
  test("preserves cached embedded fields when registering placeholders", () => {
    const document = gql`
      query {
        message {
          id
          profile {
            text
            ... @defer {
              name
            }
          }
        }
      }
    `;
    const cache = new ForestRun();
    const message = { __typename: "Message", id: "1" };
    cache.writeQuery({
      query: document,
      data: {
        message: {
          ...message,
          profile: { __typename: "Profile", text: "before", name: "cached" },
        },
      },
    });
    const write = writer(cache, document);
    write({
      data: {
        message: {
          ...message,
          profile: { __typename: "Profile", text: "after" },
        },
      },
      pending: [{ path: ["message", "profile"] }],
      hasNext: true,
    });
    expect(cache.readQuery({ query: document })).toEqual({
      message: {
        ...message,
        profile: { __typename: "Profile", text: "after", name: "cached" },
      },
    });
    write({
      incremental: [{ path: ["message", "profile"], data: { name: "Alice" } }],
      hasNext: false,
    });
    expect(cache.readQuery({ query: document })).toEqual({
      message: {
        ...message,
        profile: { __typename: "Profile", text: "after", name: "Alice" },
      },
    });
  });

  test("shares embedded bindings across aliases and pending executions", () => {
    const document = gql`
      query {
        message {
          id
          left: profile {
            text
            ... @defer {
              name
            }
          }
          right: profile {
            text
            ... @defer {
              name
            }
          }
        }
      }
    `;
    const cache = new ForestRun();
    const message = { __typename: "Message", id: "1" };
    const profile = { __typename: "Profile", text: "before" };
    const firstWrite = writer(cache, document);
    const secondWrite = writer(cache, document);
    const response = () => ({
      data: {
        message: { ...message, left: { ...profile }, right: { ...profile } },
      },
      pending: [{ path: ["message", "left"] }, { path: ["message", "right"] }],
      hasNext: true,
    });
    firstWrite(response());
    secondWrite(response());
    firstWrite({
      incremental: [{ path: ["message", "left"], data: { name: "Alice" } }],
      hasNext: false,
    });
    secondWrite({
      incremental: [{ path: ["message", "right"], data: { name: "Bob" } }],
      hasNext: false,
    });
    expect(cache.readQuery({ query: document })).toEqual({
      message: {
        ...message,
        left: { ...profile, name: "Bob" },
        right: { ...profile, name: "Bob" },
      },
    });
  });
  test("preserves an own __proto__ response alias when preparing a patch", () => {
    const document = gql`
      query {
        messages {
          id
          ... @defer {
            __proto__: name
          }
        }
      }
    `;
    const message = Object.assign(Object.create(null), {
      __typename: "Message",
      id: "1",
    });
    const cache = new ForestRun();
    const write = writer(cache, document);
    cache.writeQuery({ query, data: { messages: [first] } });
    write({ ...initial, data: { messages: [message] } });
    write({
      ...final,
      incremental: [
        { path: ["messages", 0], data: JSON.parse('{"__proto__":"Alice"}') },
      ],
    });
    expect(cache.readQuery({ query })).toEqual({
      messages: [{ ...first, name: "Alice" }],
    });
  });

  test.each(["prepend", "remove"])(
    "preserves original identities after %s",
    (change) => {
      const cache = new ForestRun();
      const write = writer(cache);
      write(initial);
      cache.writeQuery({
        query,
        data: { messages: change === "prepend" ? [second, first] : [second] },
      });
      write(final);
      expect(cache.readQuery({ query })).toEqual({
        messages:
          change === "prepend"
            ? [second, { ...first, name: "Alice" }]
            : [second],
      });
      expect(cache.getStats().treeCount).toBe(1);
    },
  );

  test("a standalone incremental write updates nested list positions in one batch", () => {
    const document = gql`
      query {
        rows {
          id
          text
          ... @defer {
            name
          }
        }
      }
    `;
    const other = { __typename: "Message", id: "2", text: "other" };
    const cache = new ForestRun();
    const token = {};
    cache.writeInitialData({
      query: document,
      data: { rows: [[first], [other]] },
      token,
      pending: [{ path: ["rows", 0, 0] }, { path: ["rows", 1, 0] }],
    });
    cache.writeQuery({ query: document, data: { rows: [[other], [first]] } });
    const notify = jest.fn();
    const unwatch = cache.watch({
      query: document,
      optimistic: false,
      callback: notify,
    });
    cache.writeIncrementalData({
      query: document,
      token,
      patches: [
        { path: ["rows", 0, 0], data: { name: "Alice" } },
        { path: ["rows", 1, 0], data: { name: "Bob" } },
      ],
    });
    unwatch();
    expect(notify).toHaveBeenCalledTimes(1);
    cache.releaseIncremental(token);
    expect(cache.readQuery({ query: document })).toEqual({
      rows: [[{ ...other, name: "Bob" }], [{ ...first, name: "Alice" }]],
    });
    expect(cache.getStats().treeCount).toBe(1);
  });

  test("keeps placeholders when indexing repairs shared source objects", () => {
    const document = gql`
      query {
        left: message {
          id
          ... @defer {
            name
          }
        }
        right: message {
          id
          ... @defer {
            name
          }
        }
      }
    `;
    const message = { __typename: "Message", id: "1" };
    const cache = new ForestRun();
    const token = {};
    cache.writeInitialData({
      query: document,
      data: { left: message, right: message },
      token,
      pending: [{ path: ["left"] }, { path: ["right"] }],
    });
    cache.writeIncrementalData({
      query: document,
      token,
      patches: [{ path: ["right"], data: { name: "Alice" } }],
    });
    cache.releaseIncremental(token);
    expect(cache.readQuery({ query: document })).toEqual({
      left: { ...message, name: "Alice" },
      right: { ...message, name: "Alice" },
    });
  });

  test("keeps existing cached values visible while awaiting the server", () => {
    const cache = new ForestRun();
    cache.writeQuery({
      query,
      data: { messages: [{ ...first, name: "cached" }] },
    });
    const write = writer(cache);
    write(initial);
    expect(cache.readQuery({ query })).toEqual({
      messages: [{ ...first, name: "cached" }],
    });
    write(final);
    expect(cache.readQuery({ query })).toEqual({
      messages: [{ ...first, name: "Alice" }],
    });
  });

  test("registers another execution even when the initial response object is reused", () => {
    const cache = new ForestRun();
    writer(cache)(initial);
    const write = writer(cache);
    write(initial);
    write(final);
    expect(cache.readQuery({ query })).toEqual({
      messages: [{ ...first, name: "Alice" }],
    });
  });

  test("writes embedded targets through the native writer", () => {
    const document = gql`
      query {
        message {
          id
          profile {
            text
            ... @defer {
              name
            }
          }
        }
      }
    `;
    const cache = new ForestRun();
    const write = writer(cache, document);
    write({
      data: {
        message: { ...first, profile: { __typename: "Profile", text: "old" } },
      },
      pending: [{ path: ["message", "profile"] }],
      hasNext: true,
    });
    write({
      ...final,
      incremental: [{ path: ["message", "profile"], data: { name: "Alice" } }],
    });
    expect(cache.readQuery({ query: document })).toMatchObject({
      message: { profile: { text: "old", name: "Alice" } },
    });
  });

  test("uses original aliases and arguments", () => {
    const document = gql`
      query {
        messages {
          id
          ... @defer {
            display: name(locale: "en")
          }
        }
      }
    `;
    const cache = new ForestRun();
    const write = writer(cache, document);
    write({
      ...initial,
      data: { messages: [{ __typename: "Message", id: "1" }] },
    });
    write({
      ...final,
      incremental: [{ path: ["messages", 0], data: { display: "Alice" } }],
    });
    expect(cache.readQuery({ query: document })).toEqual({
      messages: [{ __typename: "Message", id: "1", display: "Alice" }],
    });
  });

  test("does not resurrect evicted targets and releases terminal metadata", () => {
    const cache = new ForestRun();
    const write = writer(cache);
    write(initial);
    cache.evict({ id: "Message:1" });
    const before = cache.getStats();
    write(final);
    expect(cache.getStats()).toEqual(before);
    const token = {};
    const next = writer(cache, query, token);
    next(initial);
    next({ hasNext: false });
    expect(cache["deferredWrites"].has(token)).toBe(false);
  });

  test("ignores patches after the cache is reset", () => {
    const cache = new ForestRun();
    const write = writer(cache);
    write(initial);
    cache.reset();
    write(final);
    expect(cache.extract()).toEqual({});
  });

  test("updates ID-less targets for every query reading their owner", () => {
    const deferredQuery = gql`
      query {
        message {
          id
          profile {
            text
            ... @defer {
              name
            }
          }
        }
      }
    `;
    const plainQuery = gql`
      query {
        message {
          id
          profile {
            text
            name
          }
        }
      }
    `;
    const data = (profile: object) => ({
      message: {
        __typename: "Message",
        id: "1",
        profile: { __typename: "Profile", text: "t", ...profile },
      },
    });
    const cache = new ForestRun();
    const write = writer(cache, deferredQuery);
    write({
      data: data({}),
      pending: [{ path: ["message", "profile"] }],
      hasNext: true,
    });
    cache.writeQuery({ query: plainQuery, data: data({ name: "fromB" }) });
    write({
      incremental: [{ path: ["message", "profile"], data: { name: "Alice" } }],
      hasNext: false,
    });
    expect(cache.readQuery({ query: deferredQuery })).toEqual(
      data({ name: "Alice" }),
    );
    expect(cache.readQuery({ query: plainQuery })).toEqual(
      data({ name: "Alice" }),
    );
  });

  test("binds ID-less targets to their original owner after the owner moves", () => {
    const document = gql`
      query {
        messages {
          id
          profile {
            text
            ... @defer {
              name
            }
          }
        }
      }
    `;
    const message = (id: string, profile: object) => ({
      __typename: "Message",
      id,
      profile: { __typename: "Profile", text: id, ...profile },
    });
    const cache = new ForestRun();
    const write = writer(cache, document);
    write({
      data: { messages: [message("1", {})] },
      pending: [{ path: ["messages", 0, "profile"] }],
      hasNext: true,
    });
    cache.writeQuery({
      query: document,
      data: { messages: [message("2", { name: "Bob" }), message("1", {})] },
    });
    write({
      incremental: [
        { path: ["messages", 0, "profile"], data: { name: "Alice" } },
      ],
      hasNext: false,
    });
    expect(cache.readQuery({ query: document })).toEqual({
      messages: [
        message("2", { name: "Bob" }),
        message("1", { name: "Alice" }),
      ],
    });
  });
});
