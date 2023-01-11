import { graphql } from "@graphitation/graphql-js-tag";
import { RelayApolloCache, TypePolicies } from "../Cache";
import { InMemoryCache } from "@apollo/client";

import QueryRelayIR from "./__generated__/CacheTestQuery.graphql";
import FragmentRelayIR from "./__generated__/CacheTestFragment.graphql";
import RelayModernStore from "relay-runtime/lib/store/RelayModernStore";
import RelayRecordSource from "relay-runtime/lib/store/RelayRecordSource";

import fs from "fs";
import path from "path";
import { parse, print as printGraphQL } from "graphql";

const schema = parse(
  fs.readFileSync(path.resolve(__dirname, "schema.graphql"), "utf8"),
);

const QueryDocument = graphql`
  query CacheTestQuery(
    $conversationId: String!
    $includeNestedData: Boolean = false
  ) {
    conversation(id: $conversationId) {
      # NOTE: These /should/ be included in the build-time generated IR.
      # id
      # title
      ... on Conversation @include(if: $includeNestedData) {
        messages {
          id
          authorId
          text
          createdAt
        }
      }
      # NOTE: This should not be included in the build-time generated IR.
      ...CacheTestFragment
    }
  }

  # NOTE: This should not be included in the build-time generated IR.
  fragment CacheTestFragment on Conversation {
    id
    title
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

function apollo(typePolicies?: TypePolicies, addTypename = false) {
  return new InMemoryCache({ typePolicies, addTypename });
}

function relayWithBuildtimeGeneratedIR(typePolicies?: TypePolicies) {
  return new RelayApolloCache({ typePolicies });
}

function relayWithRuntimeGeneratedIR(typePolicies?: TypePolicies) {
  return new RelayApolloCache({ typePolicies, schema });
}

const TEST_VARIANTS = [
  { client: apollo },
  { client: relayWithBuildtimeGeneratedIR },
  { client: relayWithRuntimeGeneratedIR },
];

describe("transformDocument", () => {
  it.each([{ client: apollo }, { client: relayWithRuntimeGeneratedIR }])(
    "adds __typename to documents with $client.name",
    ({ client }) => {
      const cache = client(undefined, true);
      const transformed = cache.transformDocument(QueryDocument);
      expect(printGraphQL(transformed)).toMatchSnapshot();
    },
  );

  it("does not add __typename at runtime when build-time IR is present", () => {
    const cache = relayWithBuildtimeGeneratedIR();
    const transformed = cache.transformDocument(QueryDocument);
    expect(printGraphQL(transformed)).not.toMatch("__typename");
  });
});

describe("writeQuery/readQuery", () => {
  it.each(TEST_VARIANTS)("works with $client.name", ({ client }) => {
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
    ).toMatchSnapshot();
  });

  describe("concerning missing data", () => {
    beforeAll(() => {
      jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterAll(() => {
      jest.resetAllMocks();
    });

    it.each(TEST_VARIANTS)("works with $client.name", ({ client }) => {
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
    });
  });

  describe("concerning optimistic updates", () => {
    it.each(TEST_VARIANTS)("applies update with $client.name", ({ client }) => {
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
      ).toMatchSnapshot();
    });

    it.each(TEST_VARIANTS)("applies update with $client.name", ({ client }) => {
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
      ).toMatchSnapshot();
    });
  });
});

describe("writeFragment/readFragment", () => {
  it.each(TEST_VARIANTS)("works with $client.name", ({ client }) => {
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
    ).toMatchSnapshot();
  });

  it.each(TEST_VARIANTS)(
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
      ).toMatchSnapshot();
    },
  );

  describe("concerning missing data", () => {
    beforeAll(() => {
      jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterAll(() => {
      jest.resetAllMocks();
    });

    it.each(TEST_VARIANTS)("works with $client.name", ({ client }) => {
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
        id: expect.stringMatching(/42/),
      });
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("title"),
      );
    });
  });
});

describe("watch", () => {
  it.each(TEST_VARIANTS)("works with $client.name", ({ client }) => {
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
              expect(diff.result).toMatchSnapshot();
              expect(lastDiff).toBeUndefined();
              break;
            }
            case 2: {
              expect(diff.result).toMatchSnapshot();
              expect(lastDiff!.result).toMatchSnapshot();
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
  });
});

describe("batch", () => {
  it.each(TEST_VARIANTS)("works with $client.name", ({ client }) => {
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
  });
});

describe("diff", () => {
  beforeAll(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    jest.resetAllMocks();
  });

  it.each(TEST_VARIANTS)("works with $client.name", ({ client }) => {
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
  });
});

describe("extract/restore", () => {
  it.each(TEST_VARIANTS)("works with $client.name", ({ client }) => {
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
  });
});

describe("key-fields", () => {
  describe("concerning identification", () => {
    it.each(TEST_VARIANTS)(
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
      it.each(TEST_VARIANTS)("works with $client.name", ({ client }) => {
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
        ).toMatchSnapshot();
        expect(cache.extract()).toMatchSnapshot();
      });
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

  it("disposes the store subscription when the memoization cache evicts the entry", () => {
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

describe("field read functions", () => {
  it.only("apollo", () => {
    const client = apollo({
      Conversation: {
        fields: {
          title: {
            read: (...args: any[]) => {
              // console.log(args);
              return "Hello resolver!";
            },
          },
        },
      } as any,
    });
    client.writeQuery({ query: QueryDocument, data: RESPONSE });
    expect(client.readQuery({ query: QueryDocument })).toMatchInlineSnapshot(`
      Object {
        "conversation": Object {
          "id": "42",
          "title": "Hello resolver!",
        },
      }
    `);
  });

  // NOTE: A value for the resolver backed field may not exist in the cache, or this fails!
  // TODO: Figure out if we can still make that work, because InMemoryCache can, afaik.
  it.only("relay with build time IR", () => {
    const fieldReadFunction = (...args: any[]) => {
      console.log(args);
      return "Hello resolver!";
    };
    const client = relayWithBuildtimeGeneratedIR({
      Conversation: {
        fields: {
          title: {
            read: fieldReadFunction,
          },
        },
      } as any,
    });
    client.writeQuery({
      query: QueryDocument,
      data: {
        conversation: {
          __typename: "Conversation",
          id: "42",
          // NOTE: Uncommenting this would break
          // title: "Hello World",
        },
      },
    });
    // Duplicate the doc and add the resolver field IR
    const docWithResolver = JSON.parse(JSON.stringify(QueryDocument));
    docWithResolver.__relay.fragment.selections[0].selections[1] = {
      kind: "RelayResolver",
      name: "title",
      resolverModule: fieldReadFunction,
    };
    expect(client.readQuery({ query: docWithResolver })).toMatchInlineSnapshot(`
      Object {
        "conversation": Object {
          "id": "42",
          "title": "Hello resolver!",
        },
      }
    `);
  });

  it.only("relay with runtime IR", () => {
    const fieldReadFunction = (...args: any[]) => {
      console.log(args);
      return "Hello resolver!";
    };
    const client = relayWithRuntimeGeneratedIR({
      Conversation: {
        fields: {
          title: {
            read: fieldReadFunction,
          },
        },
      } as any,
    });
    client.writeQuery({
      query: QueryDocument,
      data: {
        conversation: {
          __typename: "Conversation",
          id: "42",
          // NOTE: Uncommenting this would break
          // title: "Hello World",
        },
      },
    });
    // Duplicate the doc and add the resolver field IR
    // const docWithResolver = JSON.parse(JSON.stringify(QueryDocument));
    // docWithResolver.__relay.fragment.selections[0].selections[1] = {
    //   kind: "RelayResolver",
    //   name: "title",
    //   resolverModule: fieldReadFunction,
    // };
    expect(client.readQuery({ query: QueryDocument })).toMatchInlineSnapshot(`
      Object {
        "conversation": Object {
          "id": "42",
          "title": "Hello resolver!",
        },
      }
    `);
  });
});
