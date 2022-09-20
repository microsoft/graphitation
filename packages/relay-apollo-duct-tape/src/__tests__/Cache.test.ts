import { graphql } from "@graphitation/graphql-js-tag";
import { Cache } from "../Cache";
import { InMemoryCache } from "@apollo/client";
import { Environment, Network, Store, RecordSource } from "relay-runtime";

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

describe("writeQuery/readQuery", () => {
  function apollo() {
    return new InMemoryCache({ addTypename: false });
  }

  function relay() {
    const environment = new Environment({
      store: new Store(new RecordSource()),
      network: Network.create(async () => {
        throw new Error(`end-to-end queries are not supported`);
      }),
    });
    return new Cache(environment);
  }

  it.each([
    // { client: apollo, query: ApolloQuery as any },
    { client: relay, query: RelayQuery as any },
  ])("works with $client.name", ({ client, query }) => {
    const cache = client();
    cache.writeQuery({
      query,
      data: RESPONSE,
      variables: { conversationId: "42" },
    });
    console.log(cache.extract());
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
});

xdescribe("writeFragment/writeFragment", () => {
  function apollo() {
    return new InMemoryCache({ addTypename: false });
  }

  function relay() {
    const environment = new Environment({
      store: new Store(new RecordSource()),
      network: Network.create(async () => {
        throw new Error(`end-to-end queries are not supported`);
      }),
    });
    return new Cache(environment);
  }

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
});

xdescribe("watch", () => {
  function apollo() {
    return new InMemoryCache({ addTypename: false });
  }

  function relay() {
    const environment = new Environment({
      store: new Store(new RecordSource()),
      network: Network.create(async () => {
        throw new Error(`end-to-end queries are not supported`);
      }),
    });
    return new Cache(environment);
  }

  it.each([
    { client: apollo, query: ApolloQuery as any },
    { client: relay, query: RelayQuery as any },
  ])("works with $client.name", ({ client, query }) => {
    expect.assertions(4);
    const cache = client();
    let count = 0;
    const promise = new Promise<void>((resolve) => {
      cache.watch({
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
    return promise;
  });
});
