import { gql } from "@apollo/client";
import { ForestRun } from "../ForestRun";

// `it.failing` is supported by jest-circus, but is missing from @types/jest@26
const itFails: jest.It = (it as any).failing;

describe("within the same operation", () => {
  it("uses first incoming result as an output", () => {
    const cache = new ForestRun();
    const query = gql`
      {
        a {
          b
        }
      }
    `;
    const input = {
      a: { b: "foo" },
    };
    cache.write({ query, result: input });
    const output = cache.diff({ query, optimistic: true });

    expect(output.result).toBe(input);
  });

  it("recycles first incoming result, when the second result has no changes", () => {
    const cache = new ForestRun();
    const query = gql`
      {
        a {
          b
        }
      }
    `;
    const input = {
      a: { b: "foo" },
    };
    const noChanges = {
      a: { b: "foo" },
    };
    cache.write({ query, result: input });
    cache.write({ query, result: noChanges });
    const output = cache.diff({ query, optimistic: true });

    expect(output.result).toBe(input);
  });

  it("recycles nested objects on updates", () => {
    const cache = new ForestRun();
    const query = gql`
      {
        a {
          b
        }
        c
      }
    `;
    const input = {
      a: { b: "foo" },
      c: "bar",
    };
    const updated = {
      a: { b: "foo" },
      c: "updated",
    };
    cache.write({ query, result: input });
    cache.write({ query, result: updated });
    const output = cache.diff<typeof input>({ query, optimistic: true });

    expect(output.result).not.toBe(updated);
    expect(output.result?.a).toBe(input.a);
  });

  // TODO
  it.skip("recycles sibling objects on updates", () => {
    const cache = new ForestRun();
    const query = gql`
      {
        a {
          b {
            c
          }
          d {
            e
          }
        }
      }
    `;
    const input = {
      a: {
        b: { c: "foo" },
        d: { e: "bar" },
      },
    };
    const updated = {
      a: {
        b: { c: "foo" },
        d: { e: "updated" },
      },
    };
    cache.write({ query, result: input });
    cache.write({ query, result: updated });
    const output = cache.diff<typeof input>({ query, optimistic: true });

    expect(output.result).not.toBe(updated);
    expect(output.result?.a.b).toBe(input.a.b);
    expect(output.result?.a.d).toBe(updated.a.d);
  });

  it("recycles lists on updates", () => {
    const cache = new ForestRun();
    const query = gql`
      {
        a {
          b
        }
        c
      }
    `;
    const input = {
      a: [{ b: "foo1" }, { b: "foo2" }],
      c: "bar",
    };
    const updated = {
      a: [{ b: "foo1" }, { b: "foo2" }],
      c: "baz",
    };
    cache.write({ query, result: input });
    cache.write({ query, result: updated });
    const output = cache.diff<typeof input>({ query, optimistic: true });

    expect(output.result).not.toBe(updated);
    expect(output.result?.a).toBe(input.a);
  });

  // TODO
  it.skip("recycles list items on updates", () => {
    const cache = new ForestRun();
    const query = gql`
      {
        a {
          b
        }
      }
    `;
    const input = {
      a: [{ b: "foo1" }, { b: "foo2" }],
    };
    const updated = {
      a: [{ b: "foo1" }, { b: "foo3" }],
    };
    cache.write({ query, result: input });
    cache.write({ query, result: updated });
    const output = cache.diff<typeof input>({ query, optimistic: true });

    expect(output.result).not.toBe(updated);
    expect(output.result?.a).not.toBe(updated.a);
    expect(output.result?.a[0]).toBe(input.a[0]);
    expect(output.result?.a[1]).toBe(updated.a[1]);
  });

  describe("with variables", () => {
    it("recycles objects with the same arguments", () => {
      const cache = new ForestRun();
      const query = gql`
        query ($foo: Boolean!) {
          a(arg: $foo) {
            b
          }
        }
      `;
      const input = {
        a: { b: "foo" },
      };
      const updated = {
        a: { b: "foo" },
      };
      cache.write({ query, result: input, variables: { foo: true } });
      cache.write({ query, result: updated, variables: { foo: true } });
      const output = cache.diff<typeof input>({
        query,
        variables: { foo: true },
        optimistic: true,
      });

      expect(output.result?.a).toBe(input.a);
      expect(output.result).toBe(input);
    });

    it("recycles objects with the same arguments in nested fields", () => {
      const cache = new ForestRun();
      const query = gql`
        query ($foo: Boolean!) {
          a {
            b(arg: $foo)
          }
        }
      `;
      const input = {
        a: { b: "foo" },
      };
      const updated = {
        a: { b: "foo" },
      };
      cache.write({ query, result: input, variables: { foo: true } });
      cache.write({ query, result: updated, variables: { foo: true } });
      const output = cache.diff<typeof input>({
        query,
        variables: { foo: true },
        optimistic: true,
      });

      expect(output.result?.a).toBe(input.a);
      expect(output.result).toBe(input);
    });
  });
});

describe("cross-operation recycling via @cache(covers)", () => {
  const ItemFragment = gql`
    fragment ItemFields on Item {
      id
      value
    }
  `;

  const ListQuery = gql`
    query ListQuery {
      items {
        ...ItemFields
      }
    }
    ${ItemFragment}
  `;

  const DetailQuery = gql`
    query DetailQuery {
      detail {
        id
        title
      }
    }
  `;

  const PreloaderQuery = gql`
    query PreloaderQuery @cache(covers: ["ListQuery", "DetailQuery"]) {
      items {
        ...ItemFields
      }
      detail {
        id
        title
      }
    }
    ${ItemFragment}
  `;

  const itemsData = [
    { __typename: "Item", id: "1", value: "a" },
    { __typename: "Item", id: "2", value: "b" },
  ];

  const detailData = { __typename: "Detail", id: "d1", title: "hello" };

  it("forward: reading covered op recycles objects from covering op", () => {
    const cache = new ForestRun();

    // Write Preloader (the covering op)
    cache.write({
      query: PreloaderQuery,
      result: { items: itemsData, detail: detailData },
    });

    // Read ListQuery — should recycle item objects from Preloader
    const list = cache.diff<{ items: typeof itemsData }>({
      query: ListQuery,
      optimistic: true,
    });

    expect(list.complete).toBe(true);
    expect(list.result?.items[0]).toBe(itemsData[0]);
    expect(list.result?.items[1]).toBe(itemsData[1]);

    // Read DetailQuery — should recycle detail object from Preloader
    const detail = cache.diff<{ detail: typeof detailData }>({
      query: DetailQuery,
      optimistic: true,
    });

    expect(detail.complete).toBe(true);
    expect(detail.result?.detail).toBe(detailData);
  });

  it("reverse: reading covering op recycles objects from covered ops", () => {
    const cache = new ForestRun();

    // Write the two covered ops first
    cache.write({
      query: ListQuery,
      result: { items: itemsData },
    });
    cache.write({
      query: DetailQuery,
      result: { detail: detailData },
    });

    // Read Preloader — should recycle objects from ListQuery and DetailQuery
    const preloader = cache.diff<{
      items: typeof itemsData;
      detail: typeof detailData;
    }>({
      query: PreloaderQuery,
      optimistic: true,
    });

    expect(preloader.complete).toBe(true);
    expect(preloader.result?.items[0]).toBe(itemsData[0]);
    expect(preloader.result?.items[1]).toBe(itemsData[1]);
    expect(preloader.result?.detail).toBe(detailData);
  });

  // Known gaps.
  //
  // The `covers` hint is only consulted by `createChunkMatcher`, and the only
  // place that runs it for a brand new tree is `growDataTree` — i.e. the very
  // first read of an operation that has never had a tree in the forest.
  //
  // Every other way of populating the covered operation's tree bypasses it:
  //   - a network write goes through `indexTree`, which only recycles from the
  //     operation's own previous tree state (`recycleTree`);
  //   - an incremental update goes through `updateTree` -> `completeObject`,
  //     which calls `hydrateDraft` without a chunk matcher at all.
  //
  // Both are the norm in a real application, so the covered operation ends up
  // with its own copies of objects the covering operation already holds, and
  // the preload buys no memory savings. These tests demonstrate that.
  describe("known gaps", () => {
    // A component subscribing to the covered query before the preloader
    // response lands produces a cache miss. `growOutputTree` still stores the
    // resulting incomplete tree in the forest, so once the preloader is
    // written, the covered tree is filled in by `updateTree` instead of being
    // grown — and `updateTree` never recycles across operations.
    //
    // Note that no network response for `ListQuery` is involved here at all:
    // every byte it returns comes from the preloader, yet none of the objects
    // are shared.
    itFails(
      "forward: recycles objects from covering op after an initial cache miss",
      () => {
        const cache = new ForestRun();

        const miss = cache.diff({ query: ListQuery, optimistic: true });
        expect(miss.complete).toBe(false);

        cache.write({
          query: PreloaderQuery,
          result: { items: itemsData, detail: detailData },
        });

        const list = cache.diff<{ items: typeof itemsData }>({
          query: ListQuery,
          optimistic: true,
        });

        expect(list.complete).toBe(true);
        expect(list.result?.items[0]).toBe(itemsData[0]);
        expect(list.result?.items[1]).toBe(itemsData[1]);
      },
    );

    // The covered query is also fetched from the network (cache-and-network, a
    // refetch, or simply a cache miss on some other field of the same query).
    // The incoming payload is deep-equal to what the preloader already wrote,
    // but the write path does not consider covering operations, so the forest
    // ends up holding two copies of every item.
    itFails(
      "forward: recycles objects from covering op when covered op is written",
      () => {
        const cache = new ForestRun();

        cache.write({
          query: PreloaderQuery,
          result: { items: itemsData, detail: detailData },
        });

        cache.write({
          query: ListQuery,
          result: {
            items: [
              { __typename: "Item", id: "1", value: "a" },
              { __typename: "Item", id: "2", value: "b" },
            ],
          },
        });

        const list = cache.diff<{ items: typeof itemsData }>({
          query: ListQuery,
          optimistic: true,
        });

        expect(list.complete).toBe(true);
        expect(list.result?.items[0]).toBe(itemsData[0]);
        expect(list.result?.items[1]).toBe(itemsData[1]);
      },
    );
  });
});

// TODO: recycling when there are:
//  - variables at different levels (i.e. different operations with the same document)
//  - merge policies
//  - read policies
//  - optimistic responses
// TODO: recycling of objects with identical selections? Probably costs outweight benefits
