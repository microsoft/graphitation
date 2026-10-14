import { ForestRun } from "../ForestRun";
import { gql } from "./helpers/descriptor";

class TestForestRun extends ForestRun {
  get dataForest() {
    return this.store.dataForest;
  }

  get optimisticLayers() {
    return this.store.optimisticLayers;
  }
}

interface IMessage {
  __typename: "Message";
  id: string;
  text: string;
}

interface IPageData {
  page: {
    __typename: "Page";
    id: string;
    items: IMessage[];
  };
}

const QUERY = gql`
  query EvictionPage($id: ID!) {
    page(id: $id) {
      __typename
      id
      items {
        __typename
        id
        text
      }
    }
  }
`;

const MESSAGE = gql`
  fragment EvictionMessage on Message {
    __typename
    id
    text
  }
`;

const SELECTED_MESSAGE = gql`
  query SelectedMessage {
    selectedMessage {
      __typename
      id
      text
    }
  }
`;

const OPTIMISTIC_MESSAGE = gql`
  mutation SetOptimisticMessage {
    setMessage {
      __typename
      id
      text
    }
  }
`;

function writePage(cache: ForestRun, id: string, itemId = id): IPageData {
  const data: IPageData = {
    page: {
      __typename: "Page",
      id,
      items: [
        { __typename: "Message", id: itemId, text: itemId },
        { __typename: "Message", id: "shared", text: "shared" },
      ],
    },
  };
  cache.writeQuery({ query: QUERY, variables: { id }, data });
  return data;
}

function expectNoObsoleteEntries(cache: TestForestRun): void {
  const { operationsByNodes, trees } = cache.dataForest;
  for (const operationIds of operationsByNodes.values()) {
    expect(operationIds.size).toBeGreaterThan(0);
    for (const operationId of operationIds) {
      expect(trees.has(operationId)).toBe(true);
    }
  }
}

function createPolicyCache(
  autoEvict: boolean,
  messageId: string,
  maxOperationCount: number,
) {
  const scheduled: (() => void)[] = [];
  const cache = new TestForestRun({
    autoEvict,
    maxOperationCount,
    typePolicies: {
      Query: {
        fields: {
          selectedMessage: {
            read: (_, { toReference }) => toReference(`Message:${messageId}`),
          },
        },
      },
    },
    scheduleAutoEviction: (run) => {
      scheduled.push(run);
      return { cancel: () => scheduled.splice(0) };
    },
  });

  return {
    cache,
    evict: () => {
      if (autoEvict) {
        expect(scheduled).toHaveLength(1);
        const [run] = scheduled.splice(0);
        run();
      } else {
        cache.gc();
      }
    },
  };
}

describe("reverse-index cleanup", () => {
  it.each([false, true])(
    "bounds the index across repeated evictions (autoEvict=%s)",
    (autoEvict) => {
      const cache = new TestForestRun({ maxOperationCount: 2, autoEvict });

      for (let id = 0; id < 20; id++) {
        writePage(cache, String(id));
        if (!autoEvict) {
          cache.gc();
        }
        expectNoObsoleteEntries(cache);
        expect(cache.dataForest.operationsByNodes.size).toBe(
          2 + cache.dataForest.trees.size * 2,
        );
      }

      expect(cache.dataForest.trees.size).toBe(2);
      expect(cache.dataForest.operationsByNodes.size).toBe(6);
      expect(cache.dataForest.operationsByNodes.get("Message:shared")).toEqual(
        new Set(cache.dataForest.trees.keys()),
      );
      expect(
        cache.readQuery({ query: QUERY, variables: { id: "19" } }),
      ).not.toBeNull();
    },
  );

  it("removes links from older versions of an evicted result", () => {
    const cache = new TestForestRun({
      maxOperationCount: 1,
      autoEvict: false,
    });
    writePage(cache, "old", "replaced");
    writePage(cache, "old", "replacement");

    const oldTree = [...cache.dataForest.trees.values()][0];
    expect(oldTree.nodes.has("Message:replaced")).toBe(false);
    expect(cache.dataForest.operationsByNodes.has("Message:replaced")).toBe(
      true,
    );

    writePage(cache, "new");
    cache.gc();

    expect(cache.dataForest.trees.size).toBe(1);
    expect(cache.dataForest.operationsByNodes.has("Message:replaced")).toBe(
      false,
    );
    expect(cache.dataForest.operationsByNodes.has("Message:replacement")).toBe(
      false,
    );
    expectNoObsoleteEntries(cache);
  });

  it("preserves watched operations and shared-node updates", () => {
    const cache = new TestForestRun({
      maxOperationCount: 1,
      autoEvict: false,
    });
    writePage(cache, "watched");
    const callback = jest.fn();
    const stopWatching = cache.watch({
      query: QUERY,
      variables: { id: "watched" },
      optimistic: true,
      callback,
    });
    writePage(cache, "evicted");
    writePage(cache, "new");
    cache.gc();

    expect(cache.dataForest.trees.size).toBe(2);
    expect(cache.dataForest.operationsByNodes.has("Page:watched")).toBe(true);
    expect(cache.dataForest.operationsByNodes.has("Page:evicted")).toBe(false);
    expectNoObsoleteEntries(cache);
    callback.mockClear();

    cache.writeFragment({
      id: "Message:shared",
      fragment: MESSAGE,
      data: { __typename: "Message", id: "shared", text: "updated" },
    });

    expect(callback).toHaveBeenCalled();
    for (const id of ["watched", "new"]) {
      expect(
        cache.readQuery<IPageData>({
          query: QUERY,
          variables: { id },
        })?.page.items[1].text,
      ).toBe("updated");
    }
    stopWatching();
  });

  it("preserves non-evictable queries", () => {
    const cache = new TestForestRun({
      maxOperationCount: 1,
      autoEvict: false,
      nonEvictableQueries: new Set(["protectedPage"]),
    });
    const protectedQuery = gql`
      query ProtectedPage {
        protectedPage {
          __typename
          id
        }
      }
    `;
    const data = {
      protectedPage: { __typename: "Page", id: "protected" },
    };
    cache.writeQuery({ query: protectedQuery, data });
    writePage(cache, "evicted");
    writePage(cache, "new");
    cache.gc();

    expect(cache.dataForest.trees.size).toBe(2);
    expect(cache.readQuery({ query: protectedQuery })).toEqual(data);
    expect(cache.dataForest.operationsByNodes.has("Page:evicted")).toBe(false);
    expectNoObsoleteEntries(cache);
  });

  it("respects partitions with automatic eviction disabled", () => {
    const cache = new TestForestRun({
      maxOperationCount: 2,
      autoEvict: true,
      partitionConfig: {
        partitions: { manual: { maxOperationCount: 1, autoEvict: false } },
        partitionKey: (tree) => {
          const id = tree.operation.variables.id;
          return typeof id === "string" && id.startsWith("manual")
            ? "manual"
            : null;
        },
      },
    });
    writePage(cache, "manual-old");
    writePage(cache, "manual-new");
    for (let id = 0; id < 20; id++) {
      writePage(cache, String(id));
    }

    expect(cache.dataForest.operationsByNodes.has("Page:manual-old")).toBe(
      true,
    );
    expect(cache.dataForest.trees.size).toBe(4);
    expectNoObsoleteEntries(cache);

    cache.gc();
    expect(cache.dataForest.operationsByNodes.has("Page:manual-old")).toBe(
      false,
    );
    expect(cache.dataForest.operationsByNodes.has("Page:manual-new")).toBe(
      true,
    );
    expect(cache.dataForest.trees.size).toBe(3);
    expectNoObsoleteEntries(cache);
  });

  it("does not alter optimistic layers or their read results", () => {
    const cache = new TestForestRun({
      maxOperationCount: 1,
      autoEvict: false,
    });
    const baseData = writePage(cache, "watched");
    const stopWatching = cache.watch({
      query: QUERY,
      variables: { id: "watched" },
      optimistic: true,
      callback: jest.fn(),
    });
    writePage(cache, "evicted");
    writePage(cache, "new");
    cache.batch({
      optimistic: "optimistic-page",
      update: (optimisticCache) =>
        writePage(optimisticCache, "watched", "optimistic"),
    });
    const layer = cache.optimisticLayers[0];
    const indexBefore = new Map(
      [...layer.operationsByNodes].map(([key, ids]) => [key, new Set(ids)]),
    );

    cache.gc();

    expect(cache.optimisticLayers[0]).toBe(layer);
    expect(layer.operationsByNodes).toEqual(indexBefore);
    expect(
      cache.readQuery<IPageData>({
        query: QUERY,
        variables: { id: "watched" },
        optimistic: true,
      })?.page.items[0].id,
    ).toBe("optimistic");
    expectNoObsoleteEntries(cache);

    cache.removeOptimistic("optimistic-page");
    expect(
      cache.readQuery({ query: QUERY, variables: { id: "watched" } }),
    ).toEqual(baseData);
    stopWatching();
  });

  it("keeps live dependencies introduced by read policies", () => {
    const cache = new TestForestRun({
      maxOperationCount: 10,
      autoEvict: false,
      typePolicies: {
        Query: {
          fields: {
            selectedMessage: {
              read: (_, { toReference }) => toReference("Message:shared"),
            },
          },
        },
      },
    });
    writePage(cache, "source");
    const callback = jest.fn();
    const stopWatching = cache.watch({
      query: SELECTED_MESSAGE,
      optimistic: true,
      immediate: true,
      callback,
    });
    const selectedTree = [...cache.dataForest.trees.values()].find(
      (tree) => tree.operation.name === "SelectedMessage",
    );
    expect(selectedTree).toBeDefined();
    expect(selectedTree?.nodes.has("Message:shared")).toBe(false);
    expect(cache.dataForest.operationsByNodes.get("Message:shared")).toContain(
      selectedTree?.operation.id,
    );

    cache.gc();
    callback.mockClear();
    cache.writeFragment({
      id: "Message:shared",
      fragment: MESSAGE,
      data: { __typename: "Message", id: "shared", text: "updated" },
    });

    expect(callback).toHaveBeenCalled();
    expect(cache.readQuery({ query: SELECTED_MESSAGE })).toEqual({
      selectedMessage: {
        __typename: "Message",
        id: "shared",
        text: "updated",
      },
    });
    stopWatching();
  });

  describe.each([false, true])(
    "overlapping optimistic mutations (optimistic-only entity=%s)",
    (optimisticOnly) => {
      it.each([false, true])(
        "preserves policy reads, layer indexes, and rollback (autoEvict=%s)",
        (autoEvict) => {
          const messageId = optimisticOnly ? "optimistic-only" : "shared";
          const { cache, evict } = createPolicyCache(autoEvict, messageId, 2);
          writePage(cache, "source");
          const stopWatchingSource = cache.watch({
            query: QUERY,
            variables: { id: "source" },
            optimistic: true,
            immediate: true,
            callback: jest.fn(),
          });
          for (let id = 0; id < 12; id++) {
            writePage(cache, `noise-${id}`);
          }
          const resultFor = (text: string) => ({
            selectedMessage: { __typename: "Message", id: messageId, text },
          });
          const addLayer = (tag: string, text: string) =>
            cache.batch({
              optimistic: tag,
              update: (optimisticCache) =>
                optimisticCache.write({
                  query: OPTIMISTIC_MESSAGE,
                  result: { setMessage: resultFor(text).selectedMessage },
                }),
            });
          const readSelected = () =>
            cache.readQuery({ query: SELECTED_MESSAGE, optimistic: true });

          addLayer("lower", "lower-value");
          const callback = jest.fn();
          const stopWatchingSelected = cache.watch({
            query: SELECTED_MESSAGE,
            optimistic: true,
            immediate: true,
            callback,
          });
          expect(readSelected()).toEqual(resultFor("lower-value"));
          addLayer("upper", "upper-value");

          const selectedTree = [...cache.dataForest.trees.values()].find(
            (tree) => tree.operation.name === "SelectedMessage",
          );
          expect(selectedTree).toBeDefined();
          expect(selectedTree?.nodes.has(`Message:${messageId}`)).toBe(false);
          expect(
            cache.dataForest.operationsByNodes.get(`Message:${messageId}`),
          ).toContain(selectedTree?.operation.id);
          if (optimisticOnly) {
            expect(
              [...cache.dataForest.trees.values()].some((tree) =>
                tree.nodes.has(`Message:${messageId}`),
              ),
            ).toBe(false);
          }
          const layersBefore = cache.optimisticLayers.map((layer) => {
            const mutation = [...layer.trees.values()].find(
              (tree) => tree.operation.name === "SetOptimisticMessage",
            );
            expect(mutation).toBeDefined();
            expect([...cache.dataForest.trees.keys()]).not.toContain(
              mutation?.operation.id,
            );
            return {
              layer,
              index: new Map(
                [...layer.operationsByNodes].map(([key, ids]) => [
                  key,
                  new Set(ids),
                ]),
              ),
            };
          });
          expect(layersBefore).toHaveLength(2);
          // Preserve the pre-GC result without encoding the existing optimistic-only stale-read bug.
          const resultBefore = readSelected();
          const treeCountBefore = cache.dataForest.trees.size;
          callback.mockClear();

          evict();

          expect(cache.dataForest.trees.size).toBeLessThan(treeCountBefore);
          expect(readSelected()).toBe(resultBefore);
          expect(callback).not.toHaveBeenCalled();
          for (const [index, before] of layersBefore.entries()) {
            expect(cache.optimisticLayers[index]).toBe(before.layer);
            expect(before.layer.operationsByNodes).toEqual(before.index);
          }
          cache.removeOptimistic("lower");
          expect(cache.optimisticLayers).toHaveLength(1);
          expect(readSelected()).toEqual(resultFor("upper-value"));
          callback.mockClear();
          cache.removeOptimistic("upper");

          expect(cache.optimisticLayers).toHaveLength(0);
          expect(readSelected()).toEqual(
            optimisticOnly ? null : resultFor("shared"),
          );
          expect(callback).toHaveBeenLastCalledWith(
            expect.objectContaining({
              complete: !optimisticOnly,
              result: optimisticOnly ? {} : resultFor("shared"),
            }),
            expect.objectContaining({
              complete: true,
              result: resultFor("upper-value"),
            }),
          );
          expect(
            cache.dataForest.operationsByNodes.get(`Message:${messageId}`),
          ).toContain(selectedTree?.operation.id);
          expectNoObsoleteEntries(cache);
          stopWatchingSelected();
          stopWatchingSource();
        },
      );
    },
  );

  it.each([false, true])(
    "refreshes a dangling policy read when an evicted node returns (autoEvict=%s)",
    (autoEvict) => {
      const { cache, evict } = createPolicyCache(autoEvict, "revived", 1);
      writePage(cache, "old", "revived");
      const oldTree = [...cache.dataForest.trees.values()][0];
      writePage(cache, "newer");
      writePage(cache, "newest");
      evict();
      expect(cache.dataForest.trees.has(oldTree.operation.id)).toBe(false);

      expect(cache.readQuery({ query: SELECTED_MESSAGE })).toBeNull();
      const message: IMessage = {
        __typename: "Message",
        id: "revived",
        text: "returned",
      };

      cache.writeFragment({
        id: "Message:revived",
        fragment: MESSAGE,
        data: message,
      });

      expect(cache.readQuery({ query: SELECTED_MESSAGE })).toEqual({
        selectedMessage: message,
      });
      expectNoObsoleteEntries(cache);
    },
  );

  it("cleans existing obsolete and empty entries even below the budget", () => {
    const cache = new TestForestRun({
      maxOperationCount: 10,
      autoEvict: false,
    });
    const data = writePage(cache, "live");
    cache.dataForest.operationsByNodes.set("Message:obsolete", new Set([-1]));
    cache.dataForest.operationsByNodes.set("Message:empty", new Set());
    cache.dataForest.operationsByNodes.get("Message:shared")?.add(-1);

    expect(cache.gc()).toEqual([]);

    expect(cache.dataForest.operationsByNodes.size).toBe(4);
    expect(
      cache.readQuery({ query: QUERY, variables: { id: "live" } }),
    ).toEqual(data);
    expectNoObsoleteEntries(cache);
  });

  it("does not scan the index when automatic eviction removes no trees", () => {
    const scheduled: (() => void)[] = [];
    const cache = new TestForestRun({
      maxOperationCount: 1,
      autoEvict: true,
      scheduleAutoEviction: (run) => {
        scheduled.push(run);
        return null;
      },
    });
    const stopWatching = ["first", "second"].map((id) => {
      writePage(cache, id);
      return cache.watch({
        query: QUERY,
        variables: { id },
        optimistic: true,
        callback: jest.fn(),
      });
    });
    const index = cache.dataForest.operationsByNodes;
    const iterate = jest.fn(() => index.entries());
    index[Symbol.iterator] = iterate;

    expect(scheduled).toHaveLength(1);
    scheduled[0]();

    expect(cache.dataForest.trees.size).toBe(2);
    expect(iterate).not.toHaveBeenCalled();
    stopWatching.forEach((stop) => stop());
  });
});
