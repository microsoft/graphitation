import { ForestRun } from "../ForestRun";
import { ForestRunCompat } from "../ForestRunCompat";
import type { IncrementalWriteSession } from "../cache/incremental";
import { gql } from "./helpers/descriptor";

const QUERY = gql`
  query Messages {
    messages {
      id
      __typename
      ... @defer(label: "text") {
        text
      }
    }
  }
`;
const message = (id: string, text?: string) => ({
  __typename: "Message",
  id,
  ...(text !== undefined ? { text } : {}),
});

class InspectableCache extends ForestRun {
  get extraRoots() {
    return this.store.dataForest.extraRootIds.size;
  }
  get incremental() {
    return this.store.dataForest.incremental;
  }
}

function setup(cache = new InspectableCache({ autoEvict: false })) {
  const writer = cache.createIncrementalWriter({ query: QUERY });
  const data = { messages: [message("1"), message("2")] };
  writer.write({ data, hasNext: true }, false);
  return { cache, writer, data };
}
function patch(writer: IncrementalWriteSession, text = "deferred", index = 0) {
  writer.write(
    {
      incremental: [
        { path: ["messages", index], label: "text", data: { text } },
      ],
      hasNext: false,
    },
    false,
  );
}
function messages(cache: ForestRun) {
  return cache.read<any>({
    query: QUERY,
    optimistic: false,
    returnPartialData: true,
  })?.messages;
}

describe("native incremental writes", () => {
  it("anchors original indexed identities after a prepend", () => {
    const { cache, writer } = setup();
    cache.write({
      query: QUERY,
      result: { messages: [message("3"), message("1"), message("2")] },
    });
    patch(writer);
    expect(messages(cache)).toEqual([
      message("3"),
      message("1", "deferred"),
      message("2"),
    ]);
  });

  it("plans deferred selections when initial data is recycled", () => {
    const cache = new InspectableCache();
    const data = { messages: [message("1"), message("2")] };
    cache.write({ query: QUERY, result: data });
    const writer = cache.createIncrementalWriter({ query: QUERY });
    writer.write({ data, hasNext: true }, false);
    patch(writer);
    expect(messages(cache)[0]).toEqual(message("1", "deferred"));
    expect(data.messages[0]).toEqual(message("1"));
  });

  it("uses indexed custom keys, aliases, defaults, and transitive possibleTypes", () => {
    const cache = new ForestRun({
      typePolicies: { Message: { keyFields: ["id"] } },
      possibleTypes: { Node: ["Actor"], Actor: ["Message"] },
    });
    const query = gql`
      query Item($deferred: Boolean! = true, $show: Boolean! = true) {
        item {
          key: id
          __typename
          ...Details @defer(if: $deferred, label: "details") @include(if: $show)
        }
      }
      fragment Details on Node {
        ... on Message {
          text
        }
      }
    `;
    const writer = cache.createIncrementalWriter({ query });
    writer.write(
      { data: { item: { key: "one", __typename: "Message" } }, hasNext: true },
      false,
    );
    writer.write(
      {
        incremental: [
          { path: ["item"], label: "details", data: { text: "ready" } },
        ],
        hasNext: false,
      },
      false,
    );
    expect(cache.read({ query, optimistic: false })).toEqual({
      item: { key: "one", __typename: "Message", text: "ready" },
    });
  });

  it("captures targets after shared-reference repair", () => {
    const cache = new ForestRun();
    const query = gql`
      query {
        left {
          id
          __typename
          ... @defer(label: "left") {
            text
          }
        }
        right {
          id
          __typename
          ... @defer(label: "right") {
            text
          }
        }
      }
    `;
    const shared = message("1");
    const writer = cache.createIncrementalWriter({ query });
    writer.write(
      { data: { left: shared, right: shared }, hasNext: true },
      false,
    );
    writer.write(
      {
        incremental: [
          { path: ["right"], label: "right", data: { text: "ready" } },
        ],
        hasNext: false,
      },
      false,
    );
    expect(cache.read({ query, optimistic: false })).toEqual({
      left: message("1", "ready"),
      right: message("1", "ready"),
    });
    expect(shared).toEqual(message("1"));
  });

  it("rejects unidentifiable deferred parents before policies or data publication", () => {
    const merge = jest.fn((_, incoming) => incoming);
    const cache = new ForestRun({
      typePolicies: { Query: { fields: { item: { merge } } } },
    });
    const query = gql`
      query {
        item {
          __typename
          ... @defer {
            text
          }
        }
      }
    `;
    const writer = cache.createIncrementalWriter({ query });
    const before = cache.extract();
    expect(() =>
      writer.write(
        { data: { item: { __typename: "Message" } }, hasNext: true },
        false,
      ),
    ).toThrow("identifiable parent");
    expect(merge).not.toHaveBeenCalled();
    expect(cache.extract()).toEqual(before);
  });

  it("updates another cached occurrence without restoring removed membership", () => {
    const { cache, writer } = setup();
    const other = gql`
      query {
        selected {
          id
          __typename
          text
        }
      }
    `;
    cache.write({ query: other, result: { selected: message("1") } });
    cache.write({ query: QUERY, result: { messages: [message("2")] } });
    patch(writer);
    expect(messages(cache)).toEqual([message("2")]);
    expect(cache.read({ query: other, optimistic: false })).toEqual({
      selected: message("1", "deferred"),
    });
  });

  it.each(["unlink", "delete-field"] as const)(
    "drops old targets after %s and recreation",
    (change) => {
      const { cache, writer } = setup();
      if (change === "unlink")
        cache.write({ query: QUERY, result: { messages: [message("2")] } });
      else cache.evict({ id: "ROOT_QUERY", fieldName: "messages" });
      cache.write({
        query: QUERY,
        result: { messages: [message("1", "recreated"), message("2")] },
      });
      patch(writer, "obsolete");
      expect(messages(cache)[0]).toEqual(message("1", "recreated"));
    },
  );

  it("drops evicted list-item patches without entering the ordinary writer", () => {
    const merge = jest.fn((_, incoming) => incoming);
    const { cache, writer } = setup(
      new InspectableCache({
        typePolicies: { Message: { fields: { text: { merge } } } },
      }),
    );
    cache.evict({ id: "Message:1" });
    const before = cache.extract();
    patch(writer);
    expect(merge).not.toHaveBeenCalled();
    expect(cache.extract()).toEqual(before);
  });

  it("does not revive an evicted target, but allows a new execution", () => {
    const cache = new ForestRun();
    const query = gql`
      query {
        item {
          id
          __typename
          ... @defer(label: "text") {
            text
          }
        }
      }
    `;
    const old = cache.createIncrementalWriter({ query });
    old.write(
      { data: { item: message("1", "initial") }, hasNext: true },
      false,
    );
    cache.evict({ id: "Message:1" });
    const fragment = gql`
      fragment MessageData on Message {
        id
        text
      }
    `;
    cache.writeFragment({
      id: "Message:1",
      fragment,
      data: message("1", "recreated"),
    });
    const fresh = cache.createIncrementalWriter({ query });
    fresh.write(
      { data: { item: message("1", "fresh") }, hasNext: true },
      false,
    );
    const result = (text: string) => ({
      incremental: [{ path: ["item"], label: "text", data: { text } }],
      hasNext: false,
    });
    old.write(result("obsolete"), false);
    expect(
      cache.readFragment({ id: "Message:1", fragment, optimistic: false }),
    ).toEqual(message("1", "fresh"));
    fresh.write(result("new"), false);
    expect(cache.read({ query, optimistic: false })).toEqual({
      item: message("1", "new"),
    });
  });

  it("still permits stale overwrites of explicitly selected fields", () => {
    const { cache, writer } = setup();
    cache.write({
      query: QUERY,
      result: { messages: [message("1", "newer"), message("2")] },
    });
    patch(writer, "older");
    expect(messages(cache)[0]).toEqual(message("1", "older"));
  });

  it("buffers out-of-order nested patches and publishes a frame atomically", () => {
    const cache = new ForestRun();
    const query = gql`
      query {
        item {
          id
          __typename
          ... @defer(label: "author") {
            author {
              id
              __typename
              ... @defer(label: "name") {
                name
              }
            }
          }
        }
      }
    `;
    const writer = cache.createIncrementalWriter({ query });
    writer.write({ data: { item: message("1") }, hasNext: true }, false);
    const callback = jest.fn();
    const unwatch = cache.watch({ query, optimistic: false, callback });
    callback.mockClear();
    writer.write(
      {
        incremental: [
          { path: ["item", "author"], label: "name", data: { name: "Alice" } },
          {
            path: ["item"],
            label: "author",
            data: { author: { id: "A", __typename: "Person" } },
          },
        ],
        hasNext: false,
      },
      false,
    );
    expect(callback).toHaveBeenCalledTimes(1);
    expect(cache.read({ query, optimistic: false })).toEqual({
      item: {
        ...message("1"),
        author: { id: "A", __typename: "Person", name: "Alice" },
      },
    });
    unwatch();
  });

  it("drops buffered descendants when their parent is gone", () => {
    const cache = new ForestRun();
    const query = gql`
      query {
        item {
          id
          __typename
          ... @defer(label: "author") {
            author {
              id
              __typename
              ... @defer(label: "name") {
                name
              }
            }
          }
        }
      }
    `;
    const writer = cache.createIncrementalWriter({ query });
    writer.write({ data: { item: message("1") }, hasNext: true }, false);
    writer.write(
      {
        incremental: [
          { path: ["item", "author"], label: "name", data: { name: "old" } },
        ],
        hasNext: true,
      },
      false,
    );
    cache.write({ query, result: { item: null } });
    writer.write(
      {
        incremental: [
          {
            path: ["item"],
            label: "author",
            data: { author: { id: "A", __typename: "Person" } },
          },
        ],
        hasNext: false,
      },
      false,
    );
    expect(cache.read({ query, optimistic: false })).toEqual({ item: null });
  });

  it.each(["write", "modify"] as const)(
    "invalidates type changes through %s even when changed back",
    (mode) => {
      const { cache, writer } = setup(
        new InspectableCache({
          dataIdFromObject: (object) =>
            typeof object.id === "string" ? `Message:${object.id}` : undefined,
        }),
      );
      for (const type of ["Bot", "Message"]) {
        if (mode === "modify")
          cache.modify({ id: "Message:1", fields: { __typename: () => type } });
        else
          cache.write({
            query: QUERY,
            result: { messages: [{ __typename: type, id: "1" }, message("2")] },
          });
      }
      patch(writer);
      expect(messages(cache)[0]).toEqual(message("1"));
    },
  );

  it("drops an aliased payload typename mismatch", () => {
    const cache = new ForestRun();
    const query = gql`
      query {
        item {
          id
          __typename
          ... @defer(label: "text") {
            kind: __typename
            text
          }
        }
      }
    `;
    const writer = cache.createIncrementalWriter({ query });
    writer.write({ data: { item: message("1") }, hasNext: true }, false);
    writer.write(
      {
        incremental: [
          {
            path: ["item"],
            label: "text",
            data: { kind: "Bot", text: "wrong shape" },
          },
        ],
        hasNext: false,
      },
      false,
    );
    expect(
      cache.read<any>({ query, optimistic: false, returnPartialData: true })
        .item.text,
    ).toBeUndefined();
  });

  it.each(["reset", "restore"] as const)(
    "invalidates pending executions on %s",
    async (mode) => {
      const cache = new ForestRunCompat();
      const writer = cache.createIncrementalWriter({ query: QUERY });
      writer.write(
        { data: { messages: [message("1")] }, hasNext: true },
        false,
      );
      if (mode === "reset") await cache.reset();
      else cache.restore(cache.extract());
      cache.write({
        query: QUERY,
        result: { messages: [message("1", "fresh")] },
      });
      patch(writer, "obsolete");
      expect(messages(cache)[0]).toEqual(message("1", "fresh"));
      writer.finish();
    },
  );

  it("keeps lazy lifecycle state on the forest and clears it on reset", async () => {
    const cache = new InspectableCache();
    cache.write({ query: QUERY, result: { messages: [message("1")] } });
    expect(cache.incremental).toBeUndefined();
    const writer = cache.createIncrementalWriter({ query: QUERY });
    const state = cache.incremental;
    await cache.reset();
    expect(cache.incremental).toBeUndefined();
    cache.createIncrementalWriter({ query: QUERY });
    expect(cache.incremental).not.toBe(state);
    writer.write({ data: { messages: [message("1")] }, hasNext: false }, false);
    expect(messages(cache)).toBeUndefined();
  });

  it("invalidates the last live occurrence during LRU eviction", () => {
    const { cache, writer } = setup(
      new InspectableCache({ maxOperationCount: 1, autoEvict: false }),
    );
    cache.write({
      query: gql`
        query {
          other
        }
      `,
      result: { other: true },
    });
    cache.gc();
    cache.write({
      query: QUERY,
      result: { messages: [message("1", "recreated")] },
    });
    patch(writer);
    expect(messages(cache)[0]).toEqual(message("1", "recreated"));
  });

  it("does not retain nested or root patch descriptors, trees, or extra roots", () => {
    const cache = new InspectableCache();
    const query = gql`
      query {
        item {
          id
          __typename
          ... @defer(label: "text") {
            text
          }
        }
        ... @defer(label: "root") {
          other
        }
      }
    `;
    const data = { item: message("1") };
    cache.write({ query, result: data });
    const stats = cache.getStats();
    const roots = cache.extraRoots;
    for (let i = 0; i < 50; i++) {
      const writer = cache.createIncrementalWriter({ query });
      writer.write({ data, hasNext: true }, false);
      writer.write(
        {
          incremental: [
            { path: ["item"], label: "text", data: { text: String(i) } },
            { path: [], label: "root", data: { other: i } },
          ],
          hasNext: false,
        },
        false,
      );
    }
    expect(cache.getStats()).toEqual(stats);
    expect(cache.extraRoots).toBe(roots);
    expect(cache.read({ query, optimistic: false })).toEqual({
      __typename: "Query",
      item: message("1", "49"),
      other: 49,
    });
  });

  it("keeps concurrent executions of the same query independent", () => {
    const { cache, writer: first } = setup();
    const second = cache.createIncrementalWriter({ query: QUERY });
    second.write(
      { data: { messages: [message("2"), message("1")] }, hasNext: true },
      false,
    );
    patch(first, "one");
    patch(second, "two");
    expect(messages(cache)).toEqual([message("2", "two"), message("1", "one")]);
  });

  it("preserves policies, batches notifications, and isolates optimistic data", () => {
    const merge = jest.fn((existing = "", incoming) => existing + incoming);
    const { cache, writer } = setup(
      new InspectableCache({
        typePolicies: { Message: { fields: { text: { merge } } } },
      }),
    );
    const second = cache.createIncrementalWriter({ query: QUERY });
    second.write(
      { data: { messages: [message("1"), message("2")] }, hasNext: true },
      false,
    );
    const extra = gql`
      query {
        messages {
          id
          __typename
          status
        }
      }
    `;
    cache.write({
      query: extra,
      result: { messages: [{ ...message("1"), status: "base" }] },
    });
    cache.batch({
      optimistic: "edit",
      update() {
        cache.write({
          query: extra,
          result: { messages: [{ ...message("1"), status: "optimistic" }] },
        });
      },
    });
    const callback = jest.fn();
    const unwatch = cache.watch({ query: QUERY, optimistic: false, callback });
    callback.mockClear();
    cache.batch({
      optimistic: false,
      update() {
        patch(writer, "a");
        patch(second, "b");
        expect(callback).not.toHaveBeenCalled();
      },
    });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(merge).toHaveBeenCalledTimes(2);
    expect(messages(cache)[0].text).toBe("ab");
    expect(
      cache.read<any>({ query: extra, optimistic: false }).messages[0].status,
    ).toBe("base");
    cache.removeOptimistic("edit");
    expect(
      cache.read<any>({ query: extra, optimistic: true }).messages[0].status,
    ).toBe("base");
    unwatch();
  });

  it("rejects creation and writes in nested optimistic transactions", () => {
    const { cache, writer } = setup();
    cache.batch({
      optimistic: "temporary",
      update() {
        expect(() => cache.createIncrementalWriter({ query: QUERY })).toThrow(
          "optimistic layer",
        );
        cache.batch({
          optimistic: false,
          update() {
            expect(() => patch(writer)).toThrow("optimistic layer");
          },
        });
      },
    });
    cache.removeOptimistic("temporary");
    patch(writer);
    expect(messages(cache)[0].text).toBe("deferred");
  });

  it("does not invalidate base targets on optimistic eviction", () => {
    const { cache, writer } = setup();
    cache.batch({
      optimistic: "delete",
      update() {
        cache.write({
          query: QUERY,
          result: { messages: [message("1", "optimistic"), message("2")] },
        });
        expect(cache.evict({ id: "Message:1" })).toBe(true);
      },
    });
    patch(writer);
    cache.removeOptimistic("delete");
    expect(messages(cache)[0]).toEqual(message("1", "deferred"));
  });

  it("honors inactive defer and conditional spreads", () => {
    const cache = new ForestRun();
    const query = gql`
      query ($later: Boolean! = false) {
        item {
          id
          __typename
          ... @defer(if: $later, label: "inactive") {
            text
          }
          ... @skip(if: true) @defer(label: "skipped") {
            other
          }
        }
      }
    `;
    const writer = cache.createIncrementalWriter({ query });
    writer.write(
      { data: { item: message("1", "initial") }, hasNext: false },
      false,
    );
    expect(cache.read({ query, optimistic: false })).toEqual({
      item: message("1", "initial"),
    });
    writer.finish();
  });

  it("rejects ambiguous labels before publishing initial data", () => {
    const cache = new ForestRun();
    const query = gql`
      query {
        item {
          id
          __typename
          ... @defer(label: "same") {
            text
          }
          ... @defer(label: "same") {
            other
          }
        }
      }
    `;
    const writer = cache.createIncrementalWriter({ query });
    const before = cache.extract();
    expect(() =>
      writer.write({ data: { item: message("1") }, hasNext: true }, false),
    ).toThrow("Ambiguous");
    expect(cache.extract()).toEqual(before);
  });

  it("rejects patches before initial data, unknown paths at completion, and writes after completion", () => {
    const cache = new ForestRun();
    const early = cache.createIncrementalWriter({ query: QUERY });
    expect(() => patch(early)).toThrow("before initial data");
    const { writer } = setup();
    writer.write(
      {
        incremental: [{ path: ["unknown"], data: { text: "missing" } }],
        hasNext: true,
      },
      false,
    );
    expect(() => writer.finish()).toThrow("Unresolved");
    writer.finish();
    expect(() => patch(writer)).toThrow("already finished");
  });

  it("rejects unsupported stream and field-defer syntax", () => {
    const cache = new ForestRun();
    expect(() =>
      cache.createIncrementalWriter({
        query: gql`
          query {
            messages @stream {
              id
            }
          }
        `,
      }),
    ).toThrow("@stream");
    expect(() =>
      cache.createIncrementalWriter({
        query: gql`
          query {
            messages @defer {
              id
            }
          }
        `,
      }),
    ).toThrow("fragments");
    const { writer } = setup();
    expect(() =>
      writer.write(
        { incremental: [{ path: ["messages", 0], items: [] } as any] },
        false,
      ),
    ).toThrow("@stream");
  });
});
