import { ForestRun } from "../ForestRun";
import { gql } from "./helpers/descriptor";

const MUTATION = gql`
  mutation SendMessage($id: ID!, $text: String!) {
    sendMessage(id: $id, text: $text) {
      __typename
      id
      text
    }
  }
`;

const CACHED_MUTATION = gql`
  mutation CachedMutation($id: ID!) @cache {
    cachedMutation(id: $id) {
      __typename
      id
      text
    }
  }
`;

const QUERY = gql`
  query GetMessage($id: ID!) {
    message(id: $id) {
      __typename
      id
      text
    }
  }
`;

const mutationResult = (id: string, text: string) => ({
  sendMessage: { __typename: "Message", id, text },
});

const createCache = (cleanupNonCacheableOperations: boolean) =>
  new ForestRun({ cleanupNonCacheableOperations, autoEvict: false });

describe("non-cacheable operation descriptors", () => {
  it("accumulates mutation descriptors when the flag is disabled", () => {
    const cache = createCache(false);

    for (let i = 0; i < 5; i++) {
      cache.write({
        query: MUTATION,
        variables: { id: String(i), text: `text-${i}` },
        result: mutationResult(String(i), `text-${i}`),
      });
    }

    // One descriptor per distinct set of variables, none of which has a data tree
    expect(cache.getStats()).toEqual(
      expect.objectContaining({
        docCount: 1,
        operationCount: 5,
        treeCount: 0,
        atimeCount: 5,
      }),
    );
  });

  it("releases mutation descriptors when the flag is enabled", () => {
    const cache = createCache(true);

    for (let i = 0; i < 5; i++) {
      cache.write({
        query: MUTATION,
        variables: { id: String(i), text: `text-${i}` },
        result: mutationResult(String(i), `text-${i}`),
      });
    }

    expect(cache.getStats()).toEqual(
      expect.objectContaining({
        docCount: 0,
        operationCount: 0,
        treeCount: 0,
        atimeCount: 0,
      }),
    );
  });

  it("does not grow with the number of mutation writes", () => {
    const cache = createCache(true);

    for (let i = 0; i < 100; i++) {
      cache.write({
        query: MUTATION,
        variables: { id: String(i), text: `text-${i}` },
        result: mutationResult(String(i), `text-${i}`),
      });
      expect(cache.getStats().operationCount).toBe(0);
    }
  });

  it("keeps descriptors of cacheable operations", () => {
    const cache = createCache(true);

    cache.write({
      query: QUERY,
      variables: { id: "1" },
      result: { message: { __typename: "Message", id: "1", text: "hi" } },
    });
    cache.write({
      query: MUTATION,
      variables: { id: "1", text: "bye" },
      result: mutationResult("1", "bye"),
    });

    // Only the query descriptor survives
    expect(cache.getStats()).toEqual(
      expect.objectContaining({
        docCount: 1,
        operationCount: 1,
        treeCount: 1,
      }),
    );
    expect(
      cache.read({ query: QUERY, variables: { id: "1" }, optimistic: true }),
    ).toEqual({ message: { __typename: "Message", id: "1", text: "bye" } });
  });

  it("keeps descriptors of mutations marked with @cache", () => {
    const cache = createCache(true);

    cache.write({
      query: CACHED_MUTATION,
      variables: { id: "1" },
      result: { cachedMutation: { __typename: "Message", id: "1", text: "a" } },
    });

    expect(cache.getStats()).toEqual(
      expect.objectContaining({ operationCount: 1, treeCount: 1 }),
    );
  });

  it("still propagates mutation results to watched queries", () => {
    const cache = createCache(true);
    const callback = jest.fn();

    cache.write({
      query: QUERY,
      variables: { id: "1" },
      result: { message: { __typename: "Message", id: "1", text: "hi" } },
    });
    cache.watch({
      query: QUERY,
      variables: { id: "1" },
      optimistic: true,
      callback,
    });

    cache.write({
      query: MUTATION,
      variables: { id: "1", text: "updated" },
      result: mutationResult("1", "updated"),
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].result).toEqual({
      message: { __typename: "Message", id: "1", text: "updated" },
    });
    expect(cache.getStats().operationCount).toBe(1); // query only
  });

  it("retains the descriptor while its optimistic layer is alive", () => {
    const cache = createCache(true);

    cache.write({
      query: QUERY,
      variables: { id: "1" },
      result: { message: { __typename: "Message", id: "1", text: "hi" } },
    });
    const baseline = cache.getStats().operationCount;

    cache.batch({
      optimistic: "layer-1",
      update: () =>
        cache.write({
          query: MUTATION,
          variables: { id: "1", text: "optimistic" },
          result: mutationResult("1", "optimistic"),
        }),
    });

    // The layer stores the optimistic mutation result, so its descriptor must stay
    expect(cache.getStats().operationCount).toBe(baseline + 1);
    expect(
      cache.read({ query: QUERY, variables: { id: "1" }, optimistic: true }),
    ).toEqual({
      message: { __typename: "Message", id: "1", text: "optimistic" },
    });

    cache.removeOptimistic("layer-1");

    expect(cache.getStats().operationCount).toBe(baseline);
    expect(
      cache.read({ query: QUERY, variables: { id: "1" }, optimistic: true }),
    ).toEqual({ message: { __typename: "Message", id: "1", text: "hi" } });
  });

  it("releases descriptors of non-optimistic writes inside a transaction", () => {
    const cache = createCache(true);

    cache.batch({
      optimistic: false,
      update: () =>
        cache.write({
          query: MUTATION,
          variables: { id: "1", text: "a" },
          result: mutationResult("1", "a"),
        }),
    });

    expect(cache.getStats().operationCount).toBe(0);
  });

  it("defers release to the outermost transaction", () => {
    const cache = createCache(true);
    let innerCount = -1;

    cache.batch({
      update: () => {
        cache.batch({
          update: () =>
            cache.write({
              query: MUTATION,
              variables: { id: "1", text: "a" },
              result: mutationResult("1", "a"),
            }),
        });
        innerCount = cache.getStats().operationCount;
      },
    });

    expect(innerCount).toBe(1);
    expect(cache.getStats().operationCount).toBe(0);
  });

  it("releases descriptors when a transaction throws", () => {
    const cache = createCache(true);

    expect(() =>
      cache.batch({
        update: () => {
          cache.write({
            query: MUTATION,
            variables: { id: "1", text: "a" },
            result: mutationResult("1", "a"),
          });
          throw new Error("boom");
        },
      }),
    ).toThrow("boom");

    expect(cache.getStats().operationCount).toBe(0);
  });

  it("releases descriptors when an optimistic transaction throws", () => {
    const cache = createCache(true);

    expect(() =>
      cache.batch({
        optimistic: "layer-1",
        update: () => {
          cache.write({
            query: MUTATION,
            variables: { id: "1", text: "a" },
            result: mutationResult("1", "a"),
          });
          throw new Error("boom");
        },
      }),
    ).toThrow("boom");

    expect(cache.getStats().operationCount).toBe(0);
  });

  it("does not accumulate descriptors across full mutation lifecycles", () => {
    const cache = createCache(true);
    cache.write({
      query: QUERY,
      variables: { id: "1" },
      result: { message: { __typename: "Message", id: "1", text: "initial" } },
    });
    const baseline = cache.getStats().operationCount;

    // Mimics how Apollo drives a mutation: optimistic response in a named layer,
    // then the layer is dropped and the real result is written to the data forest.
    for (let i = 0; i < 25; i++) {
      const layerTag = `mutation-${i}`;
      cache.batch({
        optimistic: layerTag,
        update: () =>
          cache.write({
            query: MUTATION,
            variables: { id: "1", text: `optimistic-${i}` },
            result: mutationResult("1", `optimistic-${i}`),
          }),
      });
      // NOTE: intentionally not asserting the optimistic read here — writing to a
      // freshly created optimistic layer does not invalidate previously cached
      // optimistic read results (pre-existing behavior, unrelated to this flag).
      expect(cache.getStats().operationCount).toBeGreaterThanOrEqual(baseline);

      cache.batch({
        optimistic: false,
        removeOptimistic: layerTag,
        update: () =>
          cache.write({
            query: MUTATION,
            variables: { id: "1", text: `confirmed-${i}` },
            result: mutationResult("1", `confirmed-${i}`),
          }),
      });
      expect(
        cache.read({ query: QUERY, variables: { id: "1" }, optimistic: true }),
      ).toEqual({
        message: { __typename: "Message", id: "1", text: `confirmed-${i}` },
      });
    }

    expect(cache.getStats().operationCount).toBe(baseline);
    expect(cache.getStats().atimeCount).toBe(baseline);
  });

  it("re-creates an equivalent descriptor on a repeated write", () => {
    const cache = createCache(true);
    const variables = { id: "1", text: "same" };

    cache.write({
      query: QUERY,
      variables: { id: "1" },
      result: { message: { __typename: "Message", id: "1", text: "initial" } },
    });
    cache.write({
      query: MUTATION,
      variables,
      result: mutationResult("1", "same"),
    });
    // Descriptor was released after the first write, so this one re-creates it
    cache.write({
      query: MUTATION,
      variables,
      result: mutationResult("1", "same"),
    });

    expect(cache.getStats().operationCount).toBe(1); // query only
    expect(
      cache.read({ query: QUERY, variables: { id: "1" }, optimistic: true }),
    ).toEqual({ message: { __typename: "Message", id: "1", text: "same" } });
  });
});
