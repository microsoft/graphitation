import { ApolloCache, gql } from "@apollo/client";
import { getFragmentQueryDocument } from "@apollo/client/utilities";
import { ForestRun } from "../ForestRun";

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
});

describe("with optimistic layers", () => {
  const ChatQuery = gql`
    query ChatQuery {
      chat {
        id
        messages {
          id
          text
        }
      }
    }
  `;
  const MessageNamesQuery = gql`
    query MessageNamesQuery {
      chat {
        id
        messages {
          id
          name
        }
      }
    }
  `;
  const MessagesQuery = gql`
    query MessagesQuery {
      chat {
        id
        messages {
          id
          text
          name
        }
      }
    }
  `;
  const message = (id: string, text: string) => ({
    __typename: "Message",
    id,
    text,
  });
  const chat = (messages: unknown[]) => ({
    chat: { __typename: "Chat", id: "1", messages },
  });

  it("recycles chunks when upper layer has only unrelated fields", () => {
    const cache = new ForestRun();
    const input = chat([message("1", "foo"), message("2", "bar")]);
    cache.write({ query: ChatQuery, result: input });

    cache.recordOptimisticTransaction((c) => {
      c.writeQuery({
        query: MessageNamesQuery,
        data: chat([
          { __typename: "Message", id: "1", name: "a" },
          { __typename: "Message", id: "2", name: "b" },
        ]),
      });
    }, "optimistic");
    const output = cache.diff<typeof input>({
      query: ChatQuery,
      optimistic: true,
    });

    expect(output.complete).toBe(true);
    expect(output.result).toEqual(input);
    expect(output.result?.chat.messages[0]).toBe(input.chat.messages[0]);
    expect(output.result?.chat.messages[1]).toBe(input.chat.messages[1]);
  });

  it("returns the whole result when upper layer has only unrelated fields of its nodes", () => {
    const cache = new ForestRun();
    const input = chat([message("1", "foo"), message("2", "bar")]);
    cache.write({ query: ChatQuery, result: input });

    cache.recordOptimisticTransaction((c) => {
      c.writeFragment({
        id: "Message:1",
        fragment: gql`
          fragment MessageName on Message {
            name
          }
        `,
        data: { __typename: "Message", name: "a" },
      });
    }, "optimistic");
    const output = cache.diff({ query: ChatQuery, optimistic: true });

    expect(output.result).toBe(input);
  });

  it("does not recycle chunks when upper layer changes selected fields", () => {
    const cache = new ForestRun();
    const input = chat([message("1", "foo"), message("2", "bar")]);
    cache.write({ query: ChatQuery, result: input });

    cache.recordOptimisticTransaction((c) => {
      c.writeQuery({
        query: MessagesQuery,
        data: chat([
          { ...message("1", "foo (optimistic)"), name: "a" },
          { ...message("2", "bar"), name: "b" },
        ]),
      });
    }, "optimistic");
    const output = cache.diff<typeof input>({
      query: ChatQuery,
      optimistic: true,
    });

    expect(output.result).toEqual(
      chat([message("1", "foo (optimistic)"), message("2", "bar")]),
    );
    // Same value in the upper layer: still recycled
    expect(output.result?.chat.messages[1]).toBe(input.chat.messages[1]);

    cache.removeOptimistic("optimistic");
    const final = cache.diff({ query: ChatQuery, optimistic: true });

    expect(final.result).toEqual(input);
  });

  describe("with nested nodes", () => {
    const ItemQuery = gql`
      query ItemQuery {
        top
        item {
          id
          child {
            id
            text
          }
        }
      }
    `;
    const ItemNameQuery = gql`
      {
        item {
          id
          name
        }
      }
    `;
    const ChildText = gql`
      fragment ChildText on Child {
        text
      }
    `;
    const item = (id: string, text = "base") => ({
      __typename: "Item",
      id,
      child: { __typename: "Child", id, text },
    });
    const redirectToItem2 = (c: ApolloCache<unknown>) => {
      c.writeQuery({
        query: gql`
          {
            item {
              id
            }
          }
        `,
        data: { item: { __typename: "Item", id: "2" } },
      });
      c.writeFragment({
        id: "Child:2",
        fragment: ChildText,
        data: { __typename: "Child", text: "optimistic" },
      });
    };
    const writeTop = (cache: ForestRun) =>
      cache.write({
        query: gql`
          {
            top
          }
        `,
        result: { top: "b" },
      });

    it("keeps optimistic data of nested nodes when re-reading after unrelated changes", () => {
      const cache = new ForestRun();
      cache.write({ query: ItemQuery, result: { top: "a", item: item("1") } });

      cache.recordOptimisticTransaction((c) => {
        c.writeQuery({
          query: ItemNameQuery,
          data: { item: { __typename: "Item", id: "1", name: "a" } },
        });
        c.writeFragment({
          id: "Child:1",
          fragment: ChildText,
          data: { __typename: "Child", text: "optimistic" },
        });
      }, "optimistic");
      cache.diff({ query: ItemQuery, optimistic: true });
      writeTop(cache);
      const output = cache.diff({ query: ItemQuery, optimistic: true });

      expect(output.result).toEqual({
        top: "b",
        item: item("1", "optimistic"),
      });
    });

    it("respects nested nodes evicted in upper layer when re-reading after unrelated changes", () => {
      const cache = new ForestRun();
      cache.write({ query: ItemQuery, result: { top: "a", item: item("1") } });

      cache.recordOptimisticTransaction((c) => {
        c.writeQuery({
          query: ItemNameQuery,
          data: { item: { __typename: "Item", id: "1", name: "a" } },
        });
        c.writeFragment({
          id: "Child:1",
          fragment: ChildText,
          data: item("1").child,
        });
        c.evict({ id: "Child:1" });
      }, "optimistic");
      const diff = {
        query: ItemQuery,
        optimistic: true,
        returnPartialData: true,
      };
      cache.diff(diff);
      writeTop(cache);

      expect(cache.diff(diff).complete).toBe(false);
    });

    it("does not recycle nodes outside of the read result with optimistic descendants", () => {
      const cache = new ForestRun();
      const query = gql`
        query Main {
          item {
            id
            child {
              id
              text
            }
          }
          other {
            id
          }
        }
      `;
      const other = { __typename: "Item", id: "2" };
      cache.write({ query, result: { item: item("1"), other } });
      cache.write({
        query: gql`
          query Preloader @cache(covers: ["Main"]) {
            other {
              id
              child {
                id
                text
              }
            }
          }
        `,
        result: { other: item("2") },
      });

      cache.recordOptimisticTransaction(redirectToItem2, "optimistic");
      const output = cache.diff({ query, optimistic: true });

      expect(output.result).toEqual({ item: item("2", "optimistic"), other });
    });

    it("does not recycle orphan nodes with optimistic descendants", () => {
      const cache = new ForestRun({ apolloCompat_keepOrphanNodes: true });
      cache.write({ query: ItemQuery, result: { top: "a", item: item("2") } });
      cache.write({ query: ItemQuery, result: { top: "a", item: item("1") } });

      cache.recordOptimisticTransaction(redirectToItem2, "optimistic");
      const output = cache.diff({ query: ItemQuery, optimistic: true });

      expect(output.result).toEqual({
        top: "a",
        item: item("2", "optimistic"),
      });
    });
  });

  it("does not recycle chunks when upper layer changes node type", () => {
    const cache = new ForestRun({
      addTypename: false,
      dataIdFromObject: (object) => String(object.id),
      possibleTypes: { Node: ["A", "B"] },
    });
    const fragment = gql`
      fragment Main on Node {
        id
        ... on A {
          a
        }
        ... on B {
          b
        }
      }
    `;
    cache.writeFragment({
      id: "1",
      fragment,
      data: { __typename: "A", id: "1", a: "base" },
    });

    cache.recordOptimisticTransaction((c) => {
      c.writeFragment({
        id: "1",
        fragment: gql`
          fragment WriteB on B {
            id
            b
          }
        `,
        data: { __typename: "B", id: "1", b: "optimistic" },
      });
    }, "optimistic");
    const output = cache.diff({
      query: getFragmentQueryDocument(fragment),
      id: "1",
      optimistic: true,
    });

    expect(output.result).toEqual({ id: "1", b: "optimistic" });
  });

  it("respects fields evicted in upper layer", () => {
    const cache = new ForestRun();
    cache.write({ query: ChatQuery, result: chat([message("1", "foo")]) });

    cache.recordOptimisticTransaction((c) => {
      c.writeFragment({
        id: "Message:1",
        fragment: gql`
          fragment MessageText on Message {
            text
          }
        `,
        data: { __typename: "Message", text: "foo" },
      });
      c.evict({ id: "Message:1", fieldName: "text" });
    }, "optimistic");
    const output = cache.diff({
      query: ChatQuery,
      optimistic: true,
      returnPartialData: true,
    });

    expect(output.complete).toBe(false);
  });
});
// TODO: recycling when there are:
//  - variables at different levels (i.e. different operations with the same document)
//  - merge policies
//  - read policies
//  - optimistic responses
// TODO: recycling of objects with identical selections? Probably costs outweight benefits
