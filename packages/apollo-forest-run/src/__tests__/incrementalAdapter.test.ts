import { ForestRun } from "../ForestRun";
import { ForestRunCompat } from "../ForestRunCompat";
import type {
  IncrementalCacheAdapter,
  IncrementalTarget,
} from "../cache/incremental";
import { gql } from "./helpers/descriptor";
import { parse } from "graphql";

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
const PATCH = gql`
  query Text {
    text
  }
`;
const message = (id: string, text?: string) => ({
  __typename: "Message",
  id,
  ...(text !== undefined ? { text } : {}),
});
const hooks = () => ({ onNormalized: jest.fn(), beforeWrite: jest.fn() });

class InspectableCache extends ForestRun {
  get extraRoots() {
    return this.store.dataForest.extraRootIds.size;
  }
}

function setup(cache = new InspectableCache({ autoEvict: false })) {
  const adapter = cache.createIncrementalCacheAdapter();
  const data = { messages: [message("1"), message("2")] };
  const normalized = hooks();
  adapter.write({ query: QUERY, data, overwrite: false }, normalized);
  const target = adapter.captureTarget({
    id: "Message:1",
    typename: "Message",
  });
  return { cache, adapter, data, target, normalized };
}

function patch(
  adapter: IncrementalCacheAdapter,
  target: IncrementalTarget,
  text = "deferred",
) {
  adapter.write(
    { query: PATCH, data: { text }, target, overwrite: false },
    hooks(),
  );
}

function messages(cache: ForestRun) {
  return cache.read<any>({
    query: QUERY,
    optimistic: false,
    returnPartialData: true,
  })?.messages;
}

describe("incremental cache adapter", () => {
  it("reports original identities before publication, including recycled results", () => {
    const { cache, adapter, data, normalized } = setup();
    expect(normalized.onNormalized).toHaveBeenCalledWith(
      data.messages[0],
      "Message:1",
      "Message",
    );
    const onNormalized = jest.fn();
    adapter.write(
      { query: QUERY, data, overwrite: false },
      {
        onNormalized,
        beforeWrite() {
          expect(onNormalized).toHaveBeenCalledWith(
            data.messages[1],
            "Message:2",
            "Message",
          );
          expect(messages(cache)).toEqual(data.messages);
        },
      },
    );
    expect(onNormalized).toHaveBeenCalledWith(data, "ROOT_QUERY", "Query");
  });

  it("captures aliases and custom keys from indexing, not standalone identify", () => {
    const cache = new ForestRun({
      autoEvict: false,
      typePolicies: { Message: { keyFields: ["id"] } },
    });
    const adapter = cache.createIncrementalCacheAdapter();
    const query = gql`
      query {
        item {
          key: id
          __typename
          ... @defer {
            text
          }
        }
      }
    `;
    const item = { __typename: "Message", key: "one" };
    const normalized = hooks();
    adapter.write({ query, data: { item }, overwrite: false }, normalized);
    expect(normalized.onNormalized).toHaveBeenCalledWith(
      item,
      'Message:{"id":"one"}',
      "Message",
    );
    const target = adapter.captureTarget({
      id: 'Message:{"id":"one"}',
      typename: "Message",
    });
    patch(adapter, target);
    expect(cache.read({ query, optimistic: false })).toEqual({
      item: { ...item, text: "deferred" },
    });
  });

  it("reports both original references when indexing repairs shared subtrees", () => {
    const cache = new ForestRun();
    const adapter = cache.createIncrementalCacheAdapter();
    const query = gql`
      query {
        left {
          id
          __typename
        }
        right {
          id
          __typename
        }
      }
    `;
    const shared = message("1");
    const data = { left: shared, right: shared };
    const normalized = hooks();
    adapter.write({ query, data, overwrite: false }, normalized);
    expect(normalized.onNormalized).toHaveBeenCalledWith(
      shared,
      "Message:1",
      "Message",
    );
    expect(normalized.onNormalized).toHaveBeenCalledWith(
      data,
      "ROOT_QUERY",
      "Query",
    );
    expect(
      adapter.isTargetValid(
        adapter.captureTarget({ id: "Message:1", typename: "Message" }),
      ),
    ).toBe(true);
  });

  it("validates before applying merge policies or publishing data", () => {
    const merge = jest.fn((_, incoming) => incoming);
    const { cache, adapter, target } = setup(
      new InspectableCache({
        typePolicies: { Message: { fields: { text: { merge } } } },
      }),
    );
    merge.mockClear();
    const before = cache.extract();
    const normalized = hooks();
    expect(() =>
      adapter.write(
        {
          query: PATCH,
          data: { text: "rejected" },
          target,
          overwrite: false,
        },
        {
          onNormalized: normalized.onNormalized,
          beforeWrite() {
            expect(normalized.onNormalized).toHaveBeenCalled();
            throw new Error("unsupported deferred target");
          },
        },
      ),
    ).toThrow("unsupported deferred target");
    expect(merge).not.toHaveBeenCalled();
    expect(cache.extract()).toEqual(before);
  });

  it("updates the original ID after a prepend without republishing the list", () => {
    const { cache, adapter, target } = setup();
    cache.write({
      query: QUERY,
      result: { messages: [message("3"), message("1"), message("2")] },
    });
    patch(adapter, target);
    expect(messages(cache)).toEqual([
      message("3"),
      message("1", "deferred"),
      message("2"),
    ]);
  });

  it("updates another cached occurrence after unlinking without restoring membership", () => {
    const { cache, adapter, target } = setup();
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
    expect(adapter.isTargetValid(target)).toBe(true);
    patch(adapter, target);
    expect(messages(cache)).toEqual([message("2")]);
    expect(cache.read({ query: other, optimistic: false })).toEqual({
      selected: message("1", "deferred"),
    });
  });

  it.each(["unlink", "delete-field"] as const)(
    "invalidates a target after %s and recreation with the same ID",
    (change) => {
      const { cache, adapter, target } = setup();
      if (change === "unlink")
        cache.write({ query: QUERY, result: { messages: [message("2")] } });
      if (change === "delete-field")
        cache.evict({ id: "ROOT_QUERY", fieldName: "messages" });
      cache.write({
        query: QUERY,
        result: { messages: [message("1"), message("2")] },
      });
      expect(adapter.isTargetValid(target)).toBe(false);
      patch(adapter, target);
      expect(messages(cache)[0]).toEqual(message("1"));
      expect(
        adapter.isTargetValid(
          adapter.captureTarget({ id: "Message:1", typename: "Message" }),
        ),
      ).toBe(true);
    },
  );

  it("does not revive an evicted target when the ID is recreated by a fragment write", () => {
    const cache = new ForestRun();
    const adapter = cache.createIncrementalCacheAdapter();
    const query = gql`
      query {
        item {
          id
          __typename
          text
        }
      }
    `;
    cache.write({ query, result: { item: message("1", "initial") } });
    const target = adapter.captureTarget({
      id: "Message:1",
      typename: "Message",
    });
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
    expect(adapter.isTargetValid(target)).toBe(false);
    patch(adapter, target, "obsolete");
    expect(
      cache.readFragment({ id: "Message:1", fragment, optimistic: false }),
    ).toEqual(message("1", "recreated"));
    adapter.write(
      {
        query,
        data: { item: message("1", "fresh-execution") },
        overwrite: false,
      },
      hooks(),
    );
    expect(
      adapter.isTargetValid(
        adapter.captureTarget({ id: "Message:1", typename: "Message" }),
      ),
    ).toBe(true);
    expect(adapter.isTargetValid(target)).toBe(false);
  });

  it("drops a deferred list-item patch after eviction without invoking the writer", () => {
    const { cache, adapter, target } = setup();
    cache.evict({ id: "Message:1" });
    const normalized = hooks();
    adapter.write(
      {
        query: PATCH,
        data: { text: "obsolete" },
        target,
        overwrite: false,
      },
      normalized,
    );
    expect(normalized.onNormalized).not.toHaveBeenCalled();
    expect(adapter.isTargetValid(target)).toBe(false);
  });

  it("does not invalidate a target for an unrelated scalar update", () => {
    const { cache, adapter, target } = setup();
    cache.write({
      query: QUERY,
      result: { messages: [message("1", "newer"), message("2")] },
    });
    expect(adapter.isTargetValid(target)).toBe(true);
    patch(adapter, target, "older");
    // The adapter prevents retargeting, not stale writes to explicitly deferred fields.
    expect(messages(cache)[0]).toEqual(message("1", "older"));
  });

  it("reports new child identities so the caller can anchor a nested patch", () => {
    const cache = new ForestRun();
    const adapter = cache.createIncrementalCacheAdapter();
    const query = gql`
      query {
        message {
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
    adapter.write(
      { query, data: { message: message("1") }, overwrite: false },
      hooks(),
    );
    const parent = adapter.captureTarget({
      id: "Message:1",
      typename: "Message",
    });
    const author = { id: "A", __typename: "Person" };
    const normalized = hooks();
    adapter.write(
      {
        query: gql`
          query {
            author {
              id
              __typename
              ... @defer {
                name
              }
            }
          }
        `,
        data: { author },
        target: parent,
        overwrite: false,
      },
      normalized,
    );
    expect(normalized.onNormalized).toHaveBeenCalledWith(
      author,
      "Person:A",
      "Person",
    );
    const child = adapter.captureTarget({ id: "Person:A", typename: "Person" });
    adapter.write(
      {
        query: gql`
          query {
            name
          }
        `,
        data: { name: "Alice" },
        target: child,
        overwrite: false,
      },
      hooks(),
    );
    expect(cache.read({ query, optimistic: false })).toEqual({
      message: { ...message("1"), author: { ...author, name: "Alice" } },
    });
  });

  it("invalidates type changes even when the type changes back", () => {
    const cache = new ForestRun({
      dataIdFromObject: (object) => object.id as string | undefined,
    });
    const adapter = cache.createIncrementalCacheAdapter();
    cache.write({ query: QUERY, result: { messages: [message("1")] } });
    const target = adapter.captureTarget({ id: "1", typename: "Message" });
    cache.write({
      query: QUERY,
      result: { messages: [{ __typename: "Bot", id: "1" }] },
    });
    cache.write({ query: QUERY, result: { messages: [message("1")] } });
    expect(adapter.isTargetValid(target)).toBe(false);
    patch(adapter, target);
    expect(messages(cache)[0]).toEqual(message("1"));
  });

  it("rejects a payload with a different typename", () => {
    const { adapter, target } = setup();
    expect(() =>
      adapter.write(
        {
          query: PATCH,
          data: { __typename: "Bot", text: "bad" },
          target,
          overwrite: false,
        },
        hooks(),
      ),
    ).toThrow("type does not match");
  });

  it("invalidates type changes made through modify, even when changed back", () => {
    const { cache, adapter, target } = setup(
      new InspectableCache({
        dataIdFromObject: (object) =>
          typeof object.id === "string" ? `Message:${object.id}` : undefined,
      }),
    );
    cache.modify({
      id: target.id,
      fields: { __typename: () => "Bot" },
    });
    cache.modify({
      id: target.id,
      fields: { __typename: () => "Message" },
    });
    expect(adapter.isTargetValid(target)).toBe(false);
    patch(adapter, target);
    expect(messages(cache)[0]).toEqual(message("1"));
  });

  it("invalidates adapters on reset, including an empty cache reset", async () => {
    const { cache, adapter, target } = setup();
    await cache.reset();
    cache.write({ query: QUERY, result: { messages: [message("1")] } });
    expect(adapter.isCurrent()).toBe(false);
    expect(adapter.isTargetValid(target)).toBe(false);
    expect(() => patch(adapter, target)).toThrow("invalidated by reset");
    const empty = new ForestRun();
    const emptyAdapter = empty.createIncrementalCacheAdapter();
    await empty.reset();
    expect(emptyAdapter.isCurrent()).toBe(false);
  });

  it("invalidates adapters on compatibility restore", () => {
    const cache = new ForestRunCompat();
    cache.write({ query: QUERY, result: { messages: [message("1")] } });
    const adapter = cache.createIncrementalCacheAdapter();
    const extracted = cache.extract();
    cache.restore(extracted);
    expect(adapter.isCurrent()).toBe(false);
  });

  it("invalidates the last live occurrence during LRU eviction despite stale node indexes", () => {
    const cache = new ForestRun({ maxOperationCount: 1, autoEvict: false });
    const adapter = cache.createIncrementalCacheAdapter();
    cache.write({ query: QUERY, result: { messages: [message("1")] } });
    const target = adapter.captureTarget({
      id: "Message:1",
      typename: "Message",
    });
    cache.write({
      query: gql`
        query {
          other
        }
      `,
      result: { other: true },
    });
    cache.gc();
    cache.write({ query: QUERY, result: { messages: [message("1")] } });
    expect(adapter.isTargetValid(target)).toBe(false);
  });

  it("does not cache patch operations or extra roots, even for root-level patches", () => {
    const { cache, adapter, target } = setup();
    const root = adapter.captureTarget({ id: "ROOT_QUERY", typename: "Query" });
    const stats = cache.getStats();
    const roots = cache.extraRoots;
    for (let i = 0; i < 50; i++) {
      adapter.write(
        {
          query: parse(`query Patch${i} { text }`),
          data: { text: String(i) },
          target,
          overwrite: false,
        },
        hooks(),
      );
      adapter.write(
        {
          query: parse(
            `query RootPatch${i} { messages { id __typename text } }`,
          ),
          data: { messages: [message("1", String(i)), message("2")] },
          target: root,
          overwrite: false,
        },
        hooks(),
      );
    }
    expect(cache.getStats()).toEqual(stats);
    expect(cache.extraRoots).toBe(roots);
    expect(messages(cache)[0].text).toBe("49");
  });

  it("preserves policies, notifies once at transaction completion, and isolates optimistic data", () => {
    const merge = jest.fn((existing = "", incoming) => existing + incoming);
    const { cache, adapter, target } = setup(
      new InspectableCache({
        typePolicies: { Message: { fields: { text: { merge } } } },
      }),
    );
    const callback = jest.fn();
    const unwatch = cache.watch({ query: QUERY, optimistic: false, callback });
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
    callback.mockClear();
    cache.batch({
      optimistic: false,
      update() {
        patch(adapter, target, "a");
        patch(adapter, target, "b");
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

  it("rejects adapter creation and writes in nested optimistic transactions", () => {
    const { cache, adapter, target } = setup();
    cache.batch({
      optimistic: "temporary",
      update() {
        expect(() => cache.createIncrementalCacheAdapter()).toThrow(
          "optimistic layer",
        );
        cache.batch({
          optimistic: false,
          update() {
            expect(() => patch(adapter, target)).toThrow("optimistic layer");
          },
        });
      },
    });
    cache.removeOptimistic("temporary");
    expect(adapter.isTargetValid(target)).toBe(true);
  });

  it("does not invalidate the base target for an optimistic eviction", () => {
    const { cache, adapter, target } = setup();
    cache.batch({
      optimistic: "delete",
      update() {
        cache.write({
          query: QUERY,
          result: { messages: [message("1", "optimistic"), message("2")] },
        });
        expect(cache.evict({ id: target.id })).toBe(true);
      },
    });
    expect(adapter.isTargetValid(target)).toBe(true);
    patch(adapter, target);
    cache.removeOptimistic("delete");
    expect(messages(cache)[0]).toEqual(message("1", "deferred"));
  });

  it("matches transitive possibleTypes without doing defer routing", () => {
    const cache = new ForestRun({
      possibleTypes: { Node: ["Actor"], Actor: ["Person"] },
    });
    const adapter = cache.createIncrementalCacheAdapter();
    const doc = gql`
      fragment Named on Node {
        name
      }
    `;
    const fragment = doc.definitions[0];
    if (fragment.kind !== "FragmentDefinition")
      throw new Error("expected fragment");
    expect(adapter.fragmentMatches(fragment, "Person", {}, {})).toBe(true);
    expect(adapter.fragmentMatches(fragment, "Other", {}, {})).toBe(false);
  });
});
