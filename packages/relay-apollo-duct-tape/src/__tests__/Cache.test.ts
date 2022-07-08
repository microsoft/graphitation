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
});

describe("writeFragment/writeFragment", () => {
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
