import { graphql } from "@graphitation/graphql-js-tag";
import { RelayApolloCache, TypePolicies } from "../Cache";
import { InMemoryCache } from "@apollo/client";

import QueryRelayIR from "./__generated__/CacheTestQuery.graphql";
import FragmentRelayIR from "./__generated__/CacheTestFragment.graphql";
import RelayModernStore from "relay-runtime/lib/store/RelayModernStore";
import RelayRecordSource from "relay-runtime/lib/store/RelayRecordSource";

const QueryDocument = graphql`
  query CacheTestQuery(
    $conversationId: String!
    $includeNestedData: Boolean = false
  ) {
    conversation(id: $conversationId) {
      # FIXME: This field does not show up in the relay result
      # __typename
      id
      title
      ... @include(if: $includeNestedData) {
        messages {
          id
          authorId
          text
          createdAt
        }
      }
    }
  }
`;
(QueryDocument as any).__relay = QueryRelayIR;

const FragmentDocument = graphql`
  fragment CacheTestFragment on Conversation {
    id
    title
  }
`;
(FragmentDocument as any).__relay = FragmentRelayIR;

const RESPONSE = {
  conversation: {
    __typename: "Conversation",
    id: "42",
    title: "Hello World",
  },
};

function apollo(typePolicies?: TypePolicies) {
  return new InMemoryCache({ typePolicies, addTypename: false });
}

function relay(typePolicies?: TypePolicies) {
  return new RelayApolloCache({ typePolicies });
}

describe("writeQuery/readQuery", () => {
  it.each([{ client: apollo }, { client: relay }])(
    "works with $client.name",
    ({ client }) => {
      const cache = client();
      cache.writeQuery({
        query: QueryDocument,
        data: RESPONSE,
        variables: { conversationId: "42" },
      });
      expect(
        cache.readQuery({
          query: QueryDocument,
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
    },
  );

  describe("concerning missing data", () => {
    beforeAll(() => {
      jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterAll(() => {
      jest.resetAllMocks();
    });

    it.each([{ client: apollo }, { client: relay }])(
      "works with $client.name",
      ({ client }) => {
        const cache = client();
        cache.writeQuery({
          query: QueryDocument,
          data: {
            conversation: {
              ...RESPONSE.conversation,
              title: undefined,
            },
          },
          variables: { conversationId: "42" },
        });
        expect(
          cache.readQuery({
            query: QueryDocument,
            variables: { conversationId: "42" },
          }),
        ).toBeNull();
        expect(
          cache.readQuery({
            query: QueryDocument,
            variables: { conversationId: "42" },
            returnPartialData: true,
          }),
        ).toMatchObject({
          conversation: {
            id: "42",
          },
        });
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining("title"),
        );
      },
    );
  });

  describe("concerning optimistic updates", () => {
    it.each([{ client: apollo }, { client: relay }])(
      "applies update with $client.name",
      ({ client }) => {
        const cache = client();
        cache.recordOptimisticTransaction((c) => {
          c.writeQuery({
            query: QueryDocument,
            data: RESPONSE,
            variables: { conversationId: "42" },
          });
        }, "some-id");
        expect(
          cache.readQuery({
            query: QueryDocument,
            variables: { conversationId: "42" },
            // optimistic: false, // This is the default
          }),
        ).toBeNull();
        expect(
          cache.readQuery({
            query: QueryDocument,
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
      },
    );

    it.each([{ client: apollo }, { client: relay }])(
      "applies update with $client.name",
      ({ client }) => {
        const cache = client();
        cache.writeQuery({
          query: QueryDocument,
          data: RESPONSE,
          variables: { conversationId: "42" },
        });
        cache.recordOptimisticTransaction((c) => {
          c.writeQuery({
            query: QueryDocument,
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
            query: QueryDocument,
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
      },
    );
  });
});

describe("writeFragment/readFragment", () => {
  it.each([{ client: apollo }, { client: relay }])(
    "works with $client.name",
    ({ client }) => {
      const cache = client();
      cache.writeFragment({
        fragment: FragmentDocument,
        id: "Conversation:42",
        data: RESPONSE.conversation,
        variables: { conversationId: "42" },
      });
      expect(
        cache.readFragment({
          id: "Conversation:42",
          fragment: FragmentDocument,
          variables: { conversationId: "42" },
        }),
      ).toMatchInlineSnapshot(`
      Object {
        "id": "42",
        "title": "Hello World",
      }
    `);
    },
  );

  it.each([{ client: apollo }, { client: relay }])(
    "works with $client.name and optimistic data",
    ({ client }) => {
      const cache = client();
      cache.recordOptimisticTransaction((c) => {
        c.writeFragment({
          fragment: FragmentDocument,
          id: "Conversation:42",
          data: RESPONSE.conversation,
          variables: { conversationId: "42" },
        });
      }, "some-id");
      expect(
        cache.readFragment({
          id: "Conversation:42",
          fragment: FragmentDocument,
          variables: { conversationId: "42" },
        }),
      ).toBeNull();
      expect(
        cache.readFragment({
          id: "Conversation:42",
          fragment: FragmentDocument,
          variables: { conversationId: "42" },
          optimistic: true,
        }),
      ).toMatchInlineSnapshot(`
      Object {
        "id": "42",
        "title": "Hello World",
      }
    `);
    },
  );

  describe("concerning missing data", () => {
    beforeAll(() => {
      jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterAll(() => {
      jest.resetAllMocks();
    });

    it.each([{ client: apollo }, { client: relay }])(
      "works with $client.name",
      ({ client }) => {
        const cache = client();
        cache.writeFragment({
          fragment: FragmentDocument,
          id: "Conversation:42",
          data: { ...RESPONSE.conversation, title: undefined },
          variables: { conversationId: "42" },
        });
        expect(
          cache.readFragment({
            id: "Conversation:42",
            fragment: FragmentDocument,
            variables: { conversationId: "42" },
          }),
        ).toBeNull();
        expect(
          cache.readFragment({
            id: "Conversation:42",
            fragment: FragmentDocument,
            variables: { conversationId: "42" },
            returnPartialData: true,
          }),
        ).toMatchObject({
          id: "42",
        });
        expect(console.error).toHaveBeenCalledWith(
          expect.stringContaining("title"),
        );
      },
    );
  });
});

describe("watch", () => {
  it.each([{ client: apollo }, { client: relay }])(
    "works with $client.name",
    ({ client }) => {
      expect.assertions(4);
      const cache = client();
      let count = 0;
      let disposeWatcher: () => void;
      const promise = new Promise<void>((resolve) => {
        disposeWatcher = cache.watch({
          query: QueryDocument,
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
          query: QueryDocument,
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
            query: QueryDocument,
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
    },
  );
});

describe("batch", () => {
  it.each([{ client: apollo }, { client: relay }])(
    "works with $client.name",
    ({ client }) => {
      expect.assertions(1);
      const cache = client();
      let count = 0;
      const disposeWatcher = cache.watch({
        query: QueryDocument,
        variables: { conversationId: "42" },
        optimistic: false,
        callback: (diff, lastDiff) => {
          count++;
        },
      });
      cache.batch({
        update: (c) => {
          c.writeQuery({
            query: QueryDocument,
            data: {
              conversation: {
                ...RESPONSE.conversation,
                title: "Hello World 1",
              },
            },
            variables: { conversationId: "42" },
          });
          c.writeQuery({
            query: QueryDocument,
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
    },
  );
});

describe("diff", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  it.each([{ client: apollo }, { client: relay }])(
    "works with $client.name",
    ({ client }) => {
      const cache = client();
      cache.writeQuery({
        query: QueryDocument,
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
          query: QueryDocument,
          variables: { conversationId: "42" },
          optimistic: false,
        }),
      ).toMatchObject({
        complete: false,
      });

      cache.writeQuery({
        query: QueryDocument,
        data: RESPONSE,
        variables: { conversationId: "42" },
      });
      expect(
        cache.diff<unknown>({
          query: QueryDocument,
          variables: { conversationId: "42" },
          optimistic: false,
        }),
      ).toMatchObject({
        complete: true,
      });
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("title"),
      );
    },
  );
});

describe("extract/restore", () => {
  it.each([{ client: apollo }, { client: relay }])(
    "works with $client.name",
    ({ client }) => {
      const cache = client();
      cache.writeQuery({
        query: QueryDocument,
        data: RESPONSE,
        variables: { conversationId: "42" },
      });
      const data = cache.extract();
      const newCache = client();
      newCache.restore(data as any);
      expect(newCache.extract()).toEqual(cache.extract());
    },
  );
});

describe("key-fields", () => {
  describe("concerning identification", () => {
    it.each([{ client: apollo }, { client: relay }])(
      "by default uses typename+id with $client.name",
      ({ client }) => {
        const cache = client();
        expect(cache.identify({ id: "42" })).toBeUndefined();
        expect(cache.identify({ __typename: "Conversation" })).toBeUndefined();
        expect(
          cache.identify({ __typename: "Conversation", id: "42" }),
        ).toEqual("Conversation:42");
      },
    );

    it.todo(
      "uses only the id if the type implements the Node interface with relay",
    );
  });

  describe("concerning normalization", () => {
    describe.each([
      {
        scenario: "with default key-fields",
        typePolicies: {
          Conversation: {
            keyFields: undefined,
          },
          Message: {
            keyFields: undefined,
          },
        } as TypePolicies,
      },
      {
        scenario: "without key-fields",
        typePolicies: {
          Conversation: {
            keyFields: false,
          },
          Message: {
            keyFields: false,
          },
        } as TypePolicies,
      },
      {
        scenario: "with custom key-fields",
        typePolicies: {
          Conversation: {
            keyFields: ["id", "title"],
          },
          Message: {
            keyFields: ["authorId", "createdAt", "id"],
          },
        } as TypePolicies,
      },
    ])("$scenario", ({ typePolicies }) => {
      it.each([{ client: apollo }, { client: relay }])(
        "works with $client.name",
        ({ client }) => {
          const cache = client(typePolicies);
          const response = {
            conversation: {
              ...RESPONSE.conversation,
              messages: [
                {
                  __typename: "Message",
                  id: "message-42",
                  authorId: "author-42",
                  text: "Hello World",
                  createdAt: "2020-01-01T00:00:00.000Z",
                },
              ],
            },
          };
          cache.writeQuery({
            query: QueryDocument,
            data: response,
            variables: { conversationId: "42", includeNestedData: true },
          });
          expect(
            cache.readQuery({
              query: QueryDocument,
              variables: { conversationId: "42", includeNestedData: true },
            }),
          ).toMatchInlineSnapshot(`
            Object {
              "conversation": Object {
                "id": "42",
                "messages": Array [
                  Object {
                    "authorId": "author-42",
                    "createdAt": "2020-01-01T00:00:00.000Z",
                    "id": "message-42",
                    "text": "Hello World",
                  },
                ],
                "title": "Hello World",
              },
            }
          `);
          expect(cache.extract()).toMatchSnapshot();
        },
      );
    });
  });
});

describe("read memoization", () => {
  it("does not actually hit the store again for the same query/variables", () => {
    const store = new RelayModernStore(new RelayRecordSource());
    const cache = new RelayApolloCache({ store });
    cache.writeQuery({
      query: QueryDocument,
      data: RESPONSE,
      variables: { conversationId: "42" },
    });
    const read = () => {
      return cache.readQuery({
        query: QueryDocument,
        variables: { conversationId: "42" },
      });
    };
    const spy = jest.spyOn(store, "lookup");
    const response1 = read();
    const response2 = read();
    expect(response1).toBe(response2);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it.todo(
    "removes the entry from the memoization cache when the store evicts the snapshot",
  );

  it.only("disposes the store subscription when the memoization cache evicts the entry", () => {
    const store = new RelayModernStore(new RelayRecordSource());
    const cache = new RelayApolloCache({ store, resultCacheMaxSize: 1 });
    const subscribe = jest.spyOn(store, "subscribe");

    cache.writeQuery({
      query: QueryDocument,
      data: RESPONSE,
      variables: { conversationId: "42" },
    });
    cache.readQuery({
      query: QueryDocument,
      variables: { conversationId: "42" },
    });

    const disposable = subscribe.mock.results[0].value;
    const dispose = jest.spyOn(disposable, "dispose");

    cache.writeQuery({
      query: QueryDocument,
      data: RESPONSE,
      variables: { conversationId: "43" },
    });
    cache.readQuery({
      query: QueryDocument,
      variables: { conversationId: "43" },
    });

    expect(dispose).toHaveBeenCalled();
  });
});
