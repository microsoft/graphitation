import { graphql } from "@graphitation/graphql-js-tag";
import { RelayApolloCache } from "../Cache";
import { InMemoryCache } from "@apollo/client";

import RelayQuery from "./__generated__/CacheTestQuery.graphql";
import RelayFragment from "./__generated__/CacheTestFragment.graphql";

const ApolloQuery = graphql`
  query CacheTestQuery($conversationId: String!) {
    conversation(id: $conversationId) {
      # FIXME: This field does not show up in the relay result
      # __typename
      id
      title
    }
  }
`;

const ApolloFragment = graphql`
  fragment CacheTestFragment on Conversation {
    id
    title
  }
`;

const RESPONSE = {
  conversation: {
    __typename: "Conversation",
    id: "42",
    title: "Hello World",
  },
};

function apollo() {
  return new InMemoryCache({ addTypename: false });
}

function relay() {
  return new RelayApolloCache();
}

describe("writeQuery/readQuery", () => {
  it.each([
    { client: apollo, query: ApolloQuery as any },
    { client: relay, query: RelayQuery as any },
  ])("works with $client.name", ({ client, query }) => {
    const cache = client();
    cache.writeQuery({
      query,
      data: RESPONSE,
      variables: { conversationId: "42" },
    });
    expect(
      cache.readQuery({
        query,
        variables: { conversationId: "42" },
      }),
    ).toMatchInlineSnapshot(`
      Object {
        "conversation": Object {
          "id": "42",
          "title": "Hello World",
        },
      }
    `);
  });

  describe("concerning optimistic updates", () => {
    it.each([
      { client: apollo, query: ApolloQuery as any },
      { client: relay, query: RelayQuery as any },
    ])("applies update with $client.name", ({ client, query }) => {
      const cache = client();
      cache.recordOptimisticTransaction((c) => {
        c.writeQuery({
          query,
          data: RESPONSE,
          variables: { conversationId: "42" },
        });
      }, "some-id");
      expect(
        cache.readQuery({
          query,
          variables: { conversationId: "42" },
          // optimistic: false, // This is the default
        }),
      ).toBeNull();
      expect(
        cache.readQuery({
          query,
          variables: { conversationId: "42" },
          optimistic: true,
        }),
      ).toMatchInlineSnapshot(`
        Object {
          "conversation": Object {
            "id": "42",
            "title": "Hello World",
          },
        }
      `);
    });

    it.each([
      { client: apollo, query: ApolloQuery as any },
      { client: relay, query: RelayQuery as any },
    ])("applies update with $client.name", ({ client, query }) => {
      const cache = client();
      cache.writeQuery({
        query,
        data: RESPONSE,
        variables: { conversationId: "42" },
      });
      cache.recordOptimisticTransaction((c) => {
        c.writeQuery({
          query,
          data: {
            conversation: {
              ...RESPONSE.conversation,
              title: "Hello Optimistic World",
            },
          },
          variables: { conversationId: "42" },
        });
      }, "some-transaction-id");
      cache.removeOptimistic("some-transaction-id");
      expect(
        cache.readQuery({
          query,
          variables: { conversationId: "42" },
          optimistic: true,
        }),
      ).toMatchInlineSnapshot(`
        Object {
          "conversation": Object {
            "id": "42",
            "title": "Hello World",
          },
        }
      `);
    });
  });
});

describe("writeFragment/readFragment", () => {
  it.each([
    { client: apollo, fragment: ApolloFragment as any },
    { client: relay, fragment: RelayFragment as any },
  ])("works with $client.name", ({ client, fragment }) => {
    const cache = client();
    cache.writeFragment({
      fragment,
      id: "Conversation:42",
      data: RESPONSE.conversation,
      variables: { conversationId: "42" },
    });
    expect(
      cache.readFragment({
        id: "Conversation:42",
        fragment,
        variables: { conversationId: "42" },
      }),
    ).toMatchInlineSnapshot(`
      Object {
        "id": "42",
        "title": "Hello World",
      }
    `);
  });

  it.each([
    { client: apollo, fragment: ApolloFragment as any },
    { client: relay, fragment: RelayFragment as any },
  ])("works with $client.name and optimistic data", ({ client, fragment }) => {
    const cache = client();
    cache.recordOptimisticTransaction((c) => {
      c.writeFragment({
        fragment,
        id: "Conversation:42",
        data: RESPONSE.conversation,
        variables: { conversationId: "42" },
      });
    }, "some-id");
    expect(
      cache.readFragment({
        id: "Conversation:42",
        fragment,
        variables: { conversationId: "42" },
      }),
    ).toBeNull();
    expect(
      cache.readFragment({
        id: "Conversation:42",
        fragment,
        variables: { conversationId: "42" },
        optimistic: true,
      }),
    ).toMatchInlineSnapshot(`
      Object {
        "id": "42",
        "title": "Hello World",
      }
    `);
  });
});

describe("watch", () => {
  it.each([
    { client: apollo, query: ApolloQuery as any },
    { client: relay, query: RelayQuery as any },
  ])("works with $client.name", ({ client, query }) => {
    expect.assertions(4);
    const cache = client();
    let count = 0;
    let disposeWatcher: () => void;
    const promise = new Promise<void>((resolve) => {
      disposeWatcher = cache.watch({
        query,
        variables: { conversationId: "42" },
        optimistic: false,
        callback: (diff, lastDiff) => {
          switch (++count) {
            case 1: {
              expect(diff.result).toMatchInlineSnapshot(`
                Object {
                  "conversation": Object {
                    "id": "42",
                    "title": "Hello World 1",
                  },
                }
              `);
              expect(lastDiff).toBeUndefined();
              break;
            }
            case 2: {
              expect(diff.result).toMatchInlineSnapshot(`
                Object {
                  "conversation": Object {
                    "id": "42",
                    "title": "Hello World 2",
                  },
                }
              `);
              expect(lastDiff!.result).toMatchInlineSnapshot(`
                Object {
                  "conversation": Object {
                    "id": "42",
                    "title": "Hello World 1",
                  },
                }
              `);
              resolve();
            }
          }
        },
      });
    });
    setImmediate(() => {
      cache.writeQuery({
        query,
        data: {
          conversation: {
            ...RESPONSE.conversation,
            title: "Hello World 1",
          },
        },
        variables: { conversationId: "42" },
      });
      setImmediate(() => {
        cache.writeQuery({
          query,
          data: {
            conversation: {
              ...RESPONSE.conversation,
              title: "Hello World 2",
            },
          },
          variables: { conversationId: "42" },
        });
      });
    });
    return promise.finally(disposeWatcher!);
  });
});

describe("batch", () => {
  it.each([
    { client: apollo, query: ApolloQuery as any },
    { client: relay, query: RelayQuery as any },
  ])("works with $client.name", ({ client, query }) => {
    expect.assertions(1);
    const cache = client();
    let count = 0;
    const disposeWatcher = cache.watch({
      query,
      variables: { conversationId: "42" },
      optimistic: false,
      callback: (diff, lastDiff) => {
        count++;
      },
    });
    cache.batch({
      update: (c) => {
        c.writeQuery({
          query,
          data: {
            conversation: {
              ...RESPONSE.conversation,
              title: "Hello World 1",
            },
          },
          variables: { conversationId: "42" },
        });
        c.writeQuery({
          query,
          data: {
            conversation: {
              ...RESPONSE.conversation,
              title: "Hello World 2",
            },
          },
          variables: { conversationId: "42" },
        });
      },
    });
    return new Promise<void>((resolve) => setImmediate(resolve))
      .then(() => expect(count).toEqual(1))
      .finally(disposeWatcher);
  });
});

describe("diff", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  it.each([
    { client: apollo, query: ApolloQuery as any },
    { client: relay, query: RelayQuery as any },
  ])("works with $client.name", ({ client, query }) => {
    const cache = client();
    cache.writeQuery({
      query,
      data: {
        conversation: {
          ...RESPONSE.conversation,
          title: undefined,
        },
      },
      variables: { conversationId: "42" },
    });
    expect(
      cache.diff({
        query,
        variables: { conversationId: "42" },
        optimistic: false,
      }),
    ).toMatchObject({
      complete: false,
    });

    cache.writeQuery({
      query,
      data: RESPONSE,
      variables: { conversationId: "42" },
    });
    expect(
      cache.diff<unknown>({
        query,
        variables: { conversationId: "42" },
        optimistic: false,
      }),
    ).toMatchObject({
      complete: true,
    });
  });
});

describe("extract/restore", () => {
  it.each([
    { client: apollo, query: ApolloQuery as any },
    { client: relay, query: RelayQuery as any },
  ])("works with $client.name", ({ client, query }) => {
    const cache = client();
    cache.writeQuery({
      query,
      data: RESPONSE,
      variables: { conversationId: "42" },
    });
    const data = cache.extract();
    const newCache = client();
    newCache.restore(data as any);
    expect(newCache.extract()).toEqual(cache.extract());
  });
});
