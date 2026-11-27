import { gql } from "@apollo/client";
import { ForestRun } from "../ForestRun";

describe("optimistic transactions with reuseOptimisticLayer", () => {
  const query = gql`
    query {
      a
      b
    }
  `;
  const read = (cache: ForestRun, optimistic = true) =>
    cache.diff({ query, optimistic, returnPartialData: true }).result;

  it("write to the existing layer with the same tag", () => {
    const cache = new ForestRun();
    cache.writeQuery({ query, data: { a: "a0", b: "b0" } });
    cache.batch({
      optimistic: "layer",
      update: (c) => c.writeQuery({ query, data: { a: "a1", b: "b0" } }),
    });
    cache.batch({
      optimistic: "layer",
      reuseOptimisticLayer: true,
      update: (c) => c.writeQuery({ query, data: { a: "a1", b: "b1" } }),
    });
    expect(read(cache)).toEqual({ a: "a1", b: "b1" });
    expect(read(cache, false)).toEqual({ a: "a0", b: "b0" });

    // A single layer: removed at once
    cache.removeOptimistic("layer");
    expect(read(cache)).toEqual({ a: "a0", b: "b0" });
  });

  it("create a new layer by default, or when there is no layer with the tag", () => {
    const cache = new ForestRun();
    cache.writeQuery({ query, data: { a: "a0", b: "b0" } });
    cache.batch({
      optimistic: "first",
      reuseOptimisticLayer: true,
      update: (c) => c.writeQuery({ query, data: { a: "a1", b: "b0" } }),
    });
    cache.batch({
      optimistic: "first",
      update: (c) => c.writeQuery({ query, data: { a: "a1", b: "b2" } }),
    });
    expect(read(cache)).toEqual({ a: "a1", b: "b2" });

    // Two layers with the same tag (Apollo-like): both are removed
    cache.removeOptimistic("first");
    expect(read(cache)).toEqual({ a: "a0", b: "b0" });
  });

  it("replay all transactions written to the layer when a lower layer is removed", () => {
    const cache = new ForestRun();
    cache.writeQuery({ query, data: { a: "a0", b: "b0" } });
    cache.batch({
      optimistic: "lower",
      update: (c) => c.writeQuery({ query, data: { a: "lower", b: "b0" } }),
    });
    cache.batch({
      optimistic: "upper",
      reuseOptimisticLayer: true,
      update: (c) =>
        c.writeFragment({
          id: "ROOT_QUERY",
          fragment: gql`
            fragment A on Query {
              a
            }
          `,
          data: { a: "upper" },
        }),
    });
    cache.batch({
      optimistic: "upper",
      reuseOptimisticLayer: true,
      update: (c) =>
        c.writeFragment({
          id: "ROOT_QUERY",
          fragment: gql`
            fragment B on Query {
              b
            }
          `,
          data: { b: "upper" },
        }),
    });
    expect(read(cache)).toEqual({ a: "upper", b: "upper" });

    cache.removeOptimistic("lower");
    expect(read(cache)).toEqual({ a: "upper", b: "upper" });
    cache.removeOptimistic("upper");
    expect(read(cache)).toEqual({ a: "a0", b: "b0" });
  });
});

describe("optimistic reads of covered operations", () => {
  it("do not recycle chunks of lower layers over partially matching chunks of a covering operation", () => {
    const Chat = gql`
      query Chat {
        conversation {
          id
          title
        }
      }
    `;
    const Preloader = gql`
      query Preloader @cache(covers: ["Chat"]) {
        viewer {
          id
        }
        conversation {
          id
          title
        }
      }
    `;
    const conversation = (title: string) => ({
      conversation: { __typename: "Conversation", id: "c1", title },
    });
    const preloader = (title: string) => ({
      viewer: { __typename: "User", id: "u" },
      ...conversation(title),
    });
    const cache = new ForestRun();
    cache.writeQuery({ query: Chat, data: conversation("old") });
    cache.batch({
      optimistic: "layer",
      update: (c) => c.writeQuery({ query: Preloader, data: preloader("a") }),
    });
    const read = () => cache.diff({ query: Chat, optimistic: true }).result;
    expect(read()).toEqual(conversation("a"));

    // Only the conversation is invalidated: the root chunk of the preloader in the layer has another selection
    //   (viewer), but still has precedence over the root chunk of Chat in the data forest
    cache.batch({
      optimistic: "layer",
      reuseOptimisticLayer: true,
      update: (c) => c.writeQuery({ query: Preloader, data: preloader("b") }),
    });
    expect(read()).toEqual(conversation("b"));
  });
});
