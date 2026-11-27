import { gql } from "@apollo/client";
import { ForestRun } from "../ForestRun";

const query = gql`
  query Messages {
    messages {
      id
      text
    }
  }
`;
const messageFragment = gql`
  fragment MessageText on Message {
    text
  }
`;
const messages = (...texts: string[]) => ({
  messages: texts.map((text, i) => ({
    __typename: "Message",
    id: String(i),
    text,
  })),
});
const messageId = (id: string) => `Message:${id}`;

describe("optimistic read of the operation tree in the topmost optimistic layer", () => {
  it("returns the optimistic result as is", () => {
    const cache = new ForestRun();
    const optimisticData = messages("a", "b");
    cache.writeQuery({ query, data: messages("x", "y", "z") });
    cache.recordOptimisticTransaction((c) => {
      c.writeQuery({ query, data: optimisticData });
    }, "layer");

    const result = cache.diff({ query, optimistic: true });

    expect(result.complete).toBe(true);
    expect(result.result).toBe(optimisticData);
    expect(cache.diff({ query, optimistic: false }).result).toEqual(
      messages("x", "y", "z"),
    );
  });

  it("returns the optimistic result as is without data in the main forest", () => {
    const cache = new ForestRun();
    const optimisticData = messages("a", "b");
    cache.recordOptimisticTransaction((c) => {
      c.writeQuery({ query, data: optimisticData });
    }, "layer");

    const result = cache.diff({ query, optimistic: true });

    expect(result.complete).toBe(true);
    expect(result.result).toBe(optimisticData);
  });

  it("ignores later writes to the main forest", () => {
    const cache = new ForestRun();
    const optimisticData = messages("a", "b");
    cache.writeQuery({ query, data: messages("x", "y") });
    cache.recordOptimisticTransaction((c) => {
      c.writeQuery({ query, data: optimisticData });
    }, "layer");
    cache.diff({ query, optimistic: true });
    cache.writeQuery({ query, data: messages("x", "updated") });

    expect(cache.diff({ query, optimistic: true }).result).toBe(optimisticData);
  });

  it("applies read policies", () => {
    const cache = new ForestRun({
      typePolicies: {
        Message: {
          fields: { text: { read: (text: string) => text.toUpperCase() } },
        },
      },
    });
    cache.recordOptimisticTransaction((c) => {
      c.writeQuery({ query, data: messages("a", "b") });
    }, "layer");

    expect(cache.diff({ query, optimistic: true }).result).toEqual(
      messages("A", "B"),
    );
  });

  it("reflects removal of the optimistic layer", () => {
    const cache = new ForestRun();
    const data = messages("x", "y");
    cache.writeQuery({ query, data });
    cache.recordOptimisticTransaction((c) => {
      c.writeQuery({ query, data: messages("a", "b") });
    }, "layer");
    cache.diff({ query, optimistic: true });
    cache.removeOptimistic("layer");

    expect(cache.diff({ query, optimistic: true }).result).toEqual(data);
  });

  it("falls back when a higher layer touches a node of the tree", () => {
    const cache = new ForestRun();
    const optimisticData = messages("a", "b");
    cache.recordOptimisticTransaction((c) => {
      c.writeQuery({ query, data: optimisticData });
    }, "layer1");
    cache.recordOptimisticTransaction((c) => {
      c.writeFragment({
        id: messageId("1"),
        fragment: messageFragment,
        data: { __typename: "Message", text: "updated" },
      });
    }, "layer2");

    const result = cache.diff({ query, optimistic: true });

    expect(result.complete).toBe(true);
    expect(result.result).toEqual(messages("a", "updated"));
    expect(optimisticData).toEqual(messages("a", "b"));
  });

  it("falls back when a higher layer deletes a node of the tree", () => {
    const cache = new ForestRun();
    cache.recordOptimisticTransaction((c) => {
      c.writeQuery({ query, data: messages("a", "b") });
    }, "layer1");
    cache.recordOptimisticTransaction((c) => {
      c.writeFragment({
        id: messageId("1"),
        fragment: messageFragment,
        data: { __typename: "Message", text: "b" },
      });
      c.evict({ id: messageId("1") });
    }, "layer2");

    const result = cache.diff({ query, optimistic: true });

    expect(result.complete).toBe(false);
  });

  it("falls back when the optimistic tree is incomplete", () => {
    const cache = new ForestRun();
    cache.writeQuery({ query, data: messages("x", "y") });
    cache.recordOptimisticTransaction((c) => {
      c.writeQuery({
        query,
        data: {
          messages: [
            { __typename: "Message", id: "0", text: "a" },
            { __typename: "Message", id: "1" },
          ],
        },
      });
    }, "layer");

    const result = cache.diff({ query, optimistic: true });

    expect(result.complete).toBe(true);
    expect(result.result).toEqual(messages("a", "y"));
  });
});
