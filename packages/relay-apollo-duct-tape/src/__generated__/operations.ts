import { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";
export type Maybe<T> = T | null;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
};

export type Conversation = Node & {
  __typename?: "Conversation";
  id: Scalars["ID"];
  title: Scalars["String"];
  hasUnreadMessages: Scalars["Boolean"];
  messages: MessagesConnection;
  messagesWithExtraField: MessagesConnection;
};

export type ConversationMessagesArgs = {
  first: Scalars["Int"];
  after?: Maybe<Scalars["String"]>;
  sort?: Maybe<Sort>;
};

export type ConversationMessagesWithExtraFieldArgs = {
  first?: Maybe<Scalars["Int"]>;
  after?: Maybe<Scalars["String"]>;
  sort?: Maybe<Sort>;
  callerInfo?: Maybe<Scalars["String"]>;
};

export type ConversationFilter = {
  id: Scalars["String"];
  callerInfo?: Maybe<Scalars["String"]>;
};

export type Message = Node & {
  __typename?: "Message";
  id: Scalars["ID"];
  authorId: Scalars["String"];
  text: Scalars["String"];
  createdAt: Scalars["String"];
};

export type MessagesConnection = {
  __typename?: "MessagesConnection";
  edges: Array<MessagesConnectionEdge>;
  pageInfo?: Maybe<PageInfo>;
};

export type MessagesConnectionEdge = {
  __typename?: "MessagesConnectionEdge";
  cursor?: Maybe<Scalars["String"]>;
  node: Message;
};

export type Mutation = {
  __typename?: "Mutation";
  updateConversation: Conversation;
  createMessage: Message;
};

export type MutationUpdateConversationArgs = {
  id: Scalars["String"];
  title: Scalars["String"];
};

export type MutationCreateMessageArgs = {
  conversationId: Scalars["String"];
};

export type Node = {
  id: Scalars["ID"];
};

export type PageInfo = {
  __typename?: "PageInfo";
  startCursor?: Maybe<Scalars["String"]>;
  endCursor?: Maybe<Scalars["String"]>;
  hasNextPage?: Maybe<Scalars["Boolean"]>;
  hasPreviousPage?: Maybe<Scalars["Boolean"]>;
};

export type Query = {
  __typename?: "Query";
  conversation: Conversation;
  message: Message;
  node?: Maybe<Node>;
  conversationWithGarbage: Conversation;
  conversationWithNested: Conversation;
};

export type QueryConversationArgs = {
  id: Scalars["String"];
};

export type QueryMessageArgs = {
  messageId: Scalars["String"];
};

export type QueryNodeArgs = {
  id: Scalars["ID"];
};

export type QueryConversationWithGarbageArgs = {
  id: Scalars["String"];
  callerInfo?: Maybe<Scalars["String"]>;
};

export type QueryConversationWithNestedArgs = {
  input?: Maybe<ConversationFilter>;
  moreCallerInfo?: Maybe<Scalars["String"]>;
};

export enum Sort {
  Asc = "ASC",
  Desc = "DESC",
}

export type Subscription = {
  __typename?: "Subscription";
  messageCreated: Message;
  conversationUpdated: Conversation;
};

export type SubscriptionMessageCreatedArgs = {
  conversationId: Scalars["String"];
};

export type CacheTestConversationKeyFieldsVariables = Exact<{
  id: Scalars["String"];
  callerInfo?: Maybe<Scalars["String"]>;
}>;

export type CacheTestConversationKeyFields = { __typename?: "Query" } & {
  conversationWithGarbage: { __typename?: "Conversation" } & Pick<
    Conversation,
    "id" | "title"
  >;
};

export type CacheTestConversationKeyFieldsWithConnectionLikeVariables = Exact<{
  id: Scalars["String"];
  first?: Maybe<Scalars["Int"]>;
  after?: Maybe<Scalars["String"]>;
  sort?: Maybe<Sort>;
  callerInfo?: Maybe<Scalars["String"]>;
}>;

export type CacheTestConversationKeyFieldsWithConnectionLike = {
  __typename?: "Query";
} & {
  conversation: { __typename?: "Conversation" } & Pick<
    Conversation,
    "id" | "title"
  > & {
      messagesWithExtraField: { __typename?: "MessagesConnection" } & {
        edges: Array<
          { __typename?: "MessagesConnectionEdge" } & {
            node: { __typename?: "Message" } & Pick<Message, "id">;
          }
        >;
      };
    };
};

export type CacheTestConversationKeyFieldsWithGarbageInputVariables = Exact<{
  id: Scalars["String"];
  callerInfo?: Maybe<Scalars["String"]>;
  moreCallerInfo?: Maybe<Scalars["String"]>;
}>;

export type CacheTestConversationKeyFieldsWithGarbageInput = {
  __typename?: "Query";
} & {
  conversationWithNested: { __typename?: "Conversation" } & Pick<
    Conversation,
    "id" | "title"
  >;
};

export type CacheTestConversationKeyFieldsWithGarbageInputOneVarVariables =
  Exact<{
    filter?: Maybe<ConversationFilter>;
    moreCallerInfo?: Maybe<Scalars["String"]>;
  }>;

export type CacheTestConversationKeyFieldsWithGarbageInputOneVar = {
  __typename?: "Query";
} & {
  conversationWithNested: { __typename?: "Conversation" } & Pick<
    Conversation,
    "id" | "title"
  >;
};

export type CacheTestFragment = { __typename?: "Conversation" } & Pick<
  Conversation,
  "id" | "title"
>;

export type CacheTestMessageFragment = { __typename?: "Message" } & Pick<
  Message,
  "id" | "text"
>;

export type CacheTestMessageQueryVariables = Exact<{
  id: Scalars["String"];
}>;

export type CacheTestMessageQuery = { __typename?: "Query" } & {
  message: { __typename?: "Message" } & Pick<Message, "id" | "text">;
};

export type CacheTestQueryVariables = Exact<{
  conversationId: Scalars["String"];
  includeNestedData?: Maybe<Scalars["Boolean"]>;
}>;

export type CacheTestQuery = { __typename?: "Query" } & {
  conversation: { __typename?: "Conversation" } & Pick<
    Conversation,
    "id" | "title"
  > & {
      messages: { __typename?: "MessagesConnection" } & {
        edges: Array<
          { __typename?: "MessagesConnectionEdge" } & {
            node: { __typename?: "Message" } & Pick<
              Message,
              "id" | "authorId" | "text" | "createdAt"
            >;
          }
        >;
      };
    } & CacheTestFragment;
};

export type ApolloClientIntegrationTestQueryVariables = Exact<{
  id: Scalars["String"];
  cursor?: Maybe<Scalars["String"]>;
}>;

export type ApolloClientIntegrationTestQuery = { __typename?: "Query" } & {
  conversation: { __typename: "Conversation" } & Pick<
    Conversation,
    "id" | "title"
  > & {
      messages: { __typename?: "MessagesConnection" } & {
        pageInfo?: Maybe<
          { __typename?: "PageInfo" } & Pick<
            PageInfo,
            "hasNextPage" | "endCursor"
          >
        >;
        edges: Array<
          { __typename?: "MessagesConnectionEdge" } & Pick<
            MessagesConnectionEdge,
            "cursor"
          > & {
              node: {
                __typename?: "Message";
              } & ApolloClientIntegrationTestMessageFragment;
            }
        >;
      };
    };
};

export type ApolloClientIntegrationTestMessageFragment = {
  __typename: "Message";
} & Pick<Message, "id" | "text">;

export type ApolloClientIntegrationTestMutationVariables = Exact<{
  id: Scalars["String"];
  title: Scalars["String"];
}>;

export type ApolloClientIntegrationTestMutation = {
  __typename?: "Mutation";
} & {
  updateConversation: { __typename: "Conversation" } & Pick<
    Conversation,
    "id" | "title"
  >;
};

export type ApolloClientIntegrationTestCreateMessageMutationVariables = Exact<{
  conversationId: Scalars["String"];
}>;

export type ApolloClientIntegrationTestCreateMessageMutation = {
  __typename?: "Mutation";
} & { createMessage: { __typename: "Message" } & Pick<Message, "id" | "text"> };

export type ApolloClientIntegrationTestConversationUpdatedSubscriptionVariables =
  Exact<{ [key: string]: never }>;

export type ApolloClientIntegrationTestConversationUpdatedSubscription = {
  __typename?: "Subscription";
} & {
  conversationUpdated: { __typename: "Conversation" } & Pick<
    Conversation,
    "id" | "title"
  >;
};

export type ApolloClientIntegrationTestMessageCreatedSubscriptionVariables =
  Exact<{
    conversationId: Scalars["String"];
  }>;

export type ApolloClientIntegrationTestMessageCreatedSubscription = {
  __typename?: "Subscription";
} & {
  messageCreated: { __typename: "Message" } & Pick<Message, "id" | "text">;
};

export const CacheTestFragment = {
  kind: "Document",
  definitions: [
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "CacheTestFragment" },
      typeCondition: {
        kind: "NamedType",
        name: { kind: "Name", value: "Conversation" },
      },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "title" } },
        ],
      },
      __defs: { types: { Conversation: [2, { id: 10, title: 6 }, ["Node"]] } },
    },
  ],
} as unknown as DocumentNode<CacheTestFragment, unknown>;
export const CacheTestMessageFragment = {
  kind: "Document",
  definitions: [
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "CacheTestMessageFragment" },
      typeCondition: {
        kind: "NamedType",
        name: { kind: "Name", value: "Message" },
      },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "text" } },
        ],
      },
      __defs: { types: { Message: [2, { id: 10, text: 6 }, ["Node"]] } },
    },
  ],
} as unknown as DocumentNode<CacheTestMessageFragment, unknown>;
export const ApolloClientIntegrationTestMessageFragment = {
  kind: "Document",
  definitions: [
    {
      kind: "FragmentDefinition",
      name: {
        kind: "Name",
        value: "ApolloClientIntegrationTestMessageFragment",
      },
      typeCondition: {
        kind: "NamedType",
        name: { kind: "Name", value: "Message" },
      },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "__typename" } },
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "text" } },
        ],
      },
      __defs: { types: { Message: [2, { id: 10, text: 6 }, ["Node"]] } },
    },
  ],
} as unknown as DocumentNode<
  ApolloClientIntegrationTestMessageFragment,
  unknown
>;
export const CacheTestConversationKeyFieldsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CacheTestConversationKeyFields" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "callerInfo" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "conversationWithGarbage" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "callerInfo" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "callerInfo" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "title" } },
              ],
            },
          },
        ],
      },
      __defs: {
        types: {
          Query: [
            2,
            {
              conversationWithGarbage: [
                "Conversation!",
                { id: 6, callerInfo: 1 },
              ],
            },
          ],
          Conversation: [2, { id: 10, title: 6 }, ["Node"]],
        },
      },
    },
  ],
} as unknown as DocumentNode<
  CacheTestConversationKeyFields,
  CacheTestConversationKeyFieldsVariables
>;
export const CacheTestConversationKeyFieldsWithConnectionLikeDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: {
        kind: "Name",
        value: "CacheTestConversationKeyFieldsWithConnectionLike",
      },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "first" },
          },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "Int" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "after" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "sort" } },
          type: { kind: "NamedType", name: { kind: "Name", value: "Sort" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "callerInfo" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "conversation" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "title" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "messagesWithExtraField" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "first" },
                      },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "after" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "after" },
                      },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "sort" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "sort" },
                      },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "callerInfo" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "callerInfo" },
                      },
                    },
                  ],
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "edges" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "node" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "id" },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
      __defs: {
        types: {
          Query: [2, { conversation: ["Conversation!", { id: 6 }] }],
          Conversation: [
            2,
            {
              id: 10,
              title: 6,
              messagesWithExtraField: [
                "MessagesConnection!",
                { first: 8, after: 1, sort: "Sort", callerInfo: 1 },
              ],
            },
            ["Node"],
          ],
          MessagesConnection: [2, { edges: "[MessagesConnectionEdge!]!" }],
          Sort: [5, ["ASC", "DESC"]],
          MessagesConnectionEdge: [2, { node: "Message!" }],
          Message: [2, { id: 10 }, ["Node"]],
        },
      },
    },
  ],
} as unknown as DocumentNode<
  CacheTestConversationKeyFieldsWithConnectionLike,
  CacheTestConversationKeyFieldsWithConnectionLikeVariables
>;
export const CacheTestConversationKeyFieldsWithGarbageInputDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: {
        kind: "Name",
        value: "CacheTestConversationKeyFieldsWithGarbageInput",
      },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "callerInfo" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "moreCallerInfo" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "conversationWithNested" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "ObjectValue",
                  fields: [
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "id" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "id" },
                      },
                    },
                    {
                      kind: "ObjectField",
                      name: { kind: "Name", value: "callerInfo" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "callerInfo" },
                      },
                    },
                  ],
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "moreCallerInfo" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "moreCallerInfo" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "title" } },
              ],
            },
          },
        ],
      },
      __defs: {
        types: {
          Query: [
            2,
            {
              conversationWithNested: [
                "Conversation!",
                { input: "ConversationFilter", moreCallerInfo: 1 },
              ],
            },
          ],
          Conversation: [2, { id: 10, title: 6 }, ["Node"]],
          ConversationFilter: [6, { id: 6, callerInfo: 1 }],
        },
      },
    },
  ],
} as unknown as DocumentNode<
  CacheTestConversationKeyFieldsWithGarbageInput,
  CacheTestConversationKeyFieldsWithGarbageInputVariables
>;
export const CacheTestConversationKeyFieldsWithGarbageInputOneVarDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: {
        kind: "Name",
        value: "CacheTestConversationKeyFieldsWithGarbageInputOneVar",
      },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "filter" },
          },
          type: {
            kind: "NamedType",
            name: { kind: "Name", value: "ConversationFilter" },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "moreCallerInfo" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "conversationWithNested" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "filter" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "moreCallerInfo" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "moreCallerInfo" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "title" } },
              ],
            },
          },
        ],
      },
      __defs: {
        types: {
          Query: [
            2,
            {
              conversationWithNested: [
                "Conversation!",
                { input: "ConversationFilter", moreCallerInfo: 1 },
              ],
            },
          ],
          Conversation: [2, { id: 10, title: 6 }, ["Node"]],
          ConversationFilter: [6, { id: 6, callerInfo: 1 }],
        },
      },
    },
  ],
} as unknown as DocumentNode<
  CacheTestConversationKeyFieldsWithGarbageInputOneVar,
  CacheTestConversationKeyFieldsWithGarbageInputOneVarVariables
>;
export const CacheTestMessageQueryDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CacheTestMessageQuery" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "message" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "messageId" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "text" } },
              ],
            },
          },
        ],
      },
      __defs: {
        types: {
          Query: [2, { message: ["Message!", { messageId: 6 }] }],
          Message: [2, { id: 10, text: 6 }, ["Node"]],
        },
      },
    },
  ],
} as unknown as DocumentNode<
  CacheTestMessageQuery,
  CacheTestMessageQueryVariables
>;
export const CacheTestQueryDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "CacheTestQuery" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "conversationId" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "includeNestedData" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "Boolean" } },
          defaultValue: { kind: "BooleanValue", value: false },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "conversation" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "conversationId" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "title" } },
                {
                  kind: "InlineFragment",
                  typeCondition: {
                    kind: "NamedType",
                    name: { kind: "Name", value: "Conversation" },
                  },
                  directives: [
                    {
                      kind: "Directive",
                      name: { kind: "Name", value: "include" },
                      arguments: [
                        {
                          kind: "Argument",
                          name: { kind: "Name", value: "if" },
                          value: {
                            kind: "Variable",
                            name: { kind: "Name", value: "includeNestedData" },
                          },
                        },
                      ],
                    },
                  ],
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "messages" },
                        arguments: [
                          {
                            kind: "Argument",
                            name: { kind: "Name", value: "first" },
                            value: { kind: "IntValue", value: "10" },
                          },
                        ],
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "edges" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "node" },
                                    selectionSet: {
                                      kind: "SelectionSet",
                                      selections: [
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "id" },
                                        },
                                        {
                                          kind: "Field",
                                          name: {
                                            kind: "Name",
                                            value: "authorId",
                                          },
                                        },
                                        {
                                          kind: "Field",
                                          name: { kind: "Name", value: "text" },
                                        },
                                        {
                                          kind: "Field",
                                          name: {
                                            kind: "Name",
                                            value: "createdAt",
                                          },
                                        },
                                      ],
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                {
                  kind: "FragmentSpread",
                  name: { kind: "Name", value: "CacheTestFragment" },
                },
              ],
            },
          },
        ],
      },
      __defs: {
        types: {
          Query: [2, { conversation: ["Conversation!", { id: 6 }] }],
          Conversation: [
            2,
            {
              id: 10,
              title: 6,
              messages: ["MessagesConnection!", { first: 8 }],
            },
            ["Node"],
          ],
          MessagesConnection: [2, { edges: "[MessagesConnectionEdge!]!" }],
          MessagesConnectionEdge: [2, { node: "Message!" }],
          Message: [
            2,
            { id: 10, authorId: 6, text: 6, createdAt: 6 },
            ["Node"],
          ],
        },
      },
    },
    ...CacheTestFragment.definitions,
  ],
} as unknown as DocumentNode<CacheTestQuery, CacheTestQueryVariables>;
export const ApolloClientIntegrationTestQueryDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "ApolloClientIntegrationTestQuery" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "cursor" },
          },
          type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "conversation" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "title" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "messages" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "first" },
                      value: { kind: "IntValue", value: "10" },
                    },
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "after" },
                      value: {
                        kind: "Variable",
                        name: { kind: "Name", value: "cursor" },
                      },
                    },
                  ],
                  directives: [
                    {
                      kind: "Directive",
                      name: { kind: "Name", value: "connection" },
                      arguments: [
                        {
                          kind: "Argument",
                          name: { kind: "Name", value: "key" },
                          value: {
                            kind: "StringValue",
                            value: "IntegrationTest_messages",
                            block: false,
                          },
                        },
                      ],
                    },
                  ],
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "pageInfo" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "hasNextPage" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "endCursor" },
                            },
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "edges" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "cursor" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "node" },
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  {
                                    kind: "FragmentSpread",
                                    name: {
                                      kind: "Name",
                                      value:
                                        "ApolloClientIntegrationTestMessageFragment",
                                    },
                                  },
                                ],
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
      __defs: {
        types: {
          Query: [2, { conversation: ["Conversation!", { id: 6 }] }],
          Conversation: [
            2,
            {
              id: 10,
              title: 6,
              messages: ["MessagesConnection!", { first: 8, after: 1 }],
            },
            ["Node"],
          ],
          MessagesConnection: [
            2,
            { pageInfo: "PageInfo", edges: "[MessagesConnectionEdge!]!" },
          ],
          PageInfo: [2, { hasNextPage: 2, endCursor: 1 }],
          MessagesConnectionEdge: [2, { cursor: 1, node: "Message!" }],
          Message: [2, {}, ["Node"]],
        },
        directives: [["connection", { key: 6 }]],
      },
    },
    ...ApolloClientIntegrationTestMessageFragment.definitions,
  ],
} as unknown as DocumentNode<
  ApolloClientIntegrationTestQuery,
  ApolloClientIntegrationTestQueryVariables
>;
export const ApolloClientIntegrationTestMutationDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "ApolloClientIntegrationTestMutation" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "title" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updateConversation" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "title" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "title" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "title" } },
              ],
            },
          },
        ],
      },
      __defs: {
        types: {
          Mutation: [
            2,
            { updateConversation: ["Conversation!", { id: 6, title: 6 }] },
          ],
          Conversation: [2, { id: 10, title: 6 }, ["Node"]],
        },
      },
    },
  ],
} as unknown as DocumentNode<
  ApolloClientIntegrationTestMutation,
  ApolloClientIntegrationTestMutationVariables
>;
export const ApolloClientIntegrationTestCreateMessageMutationDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: {
        kind: "Name",
        value: "ApolloClientIntegrationTestCreateMessageMutation",
      },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "conversationId" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "createMessage" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "conversationId" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "conversationId" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "text" } },
              ],
            },
          },
        ],
      },
      __defs: {
        types: {
          Mutation: [2, { createMessage: ["Message!", { conversationId: 6 }] }],
          Message: [2, { id: 10, text: 6 }, ["Node"]],
        },
      },
    },
  ],
} as unknown as DocumentNode<
  ApolloClientIntegrationTestCreateMessageMutation,
  ApolloClientIntegrationTestCreateMessageMutationVariables
>;
export const ApolloClientIntegrationTestConversationUpdatedSubscriptionDocument =
  {
    kind: "Document",
    definitions: [
      {
        kind: "OperationDefinition",
        operation: "subscription",
        name: {
          kind: "Name",
          value: "ApolloClientIntegrationTestConversationUpdatedSubscription",
        },
        selectionSet: {
          kind: "SelectionSet",
          selections: [
            {
              kind: "Field",
              name: { kind: "Name", value: "conversationUpdated" },
              selectionSet: {
                kind: "SelectionSet",
                selections: [
                  {
                    kind: "Field",
                    name: { kind: "Name", value: "__typename" },
                  },
                  { kind: "Field", name: { kind: "Name", value: "id" } },
                  { kind: "Field", name: { kind: "Name", value: "title" } },
                ],
              },
            },
          ],
        },
        __defs: {
          types: {
            Subscription: [2, { conversationUpdated: "Conversation!" }],
            Conversation: [2, { id: 10, title: 6 }, ["Node"]],
          },
        },
      },
    ],
  } as unknown as DocumentNode<
    ApolloClientIntegrationTestConversationUpdatedSubscription,
    ApolloClientIntegrationTestConversationUpdatedSubscriptionVariables
  >;
export const ApolloClientIntegrationTestMessageCreatedSubscriptionDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "subscription",
      name: {
        kind: "Name",
        value: "ApolloClientIntegrationTestMessageCreatedSubscription",
      },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "conversationId" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "messageCreated" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "conversationId" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "conversationId" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "text" } },
              ],
            },
          },
        ],
      },
      __defs: {
        types: {
          Subscription: [
            2,
            { messageCreated: ["Message!", { conversationId: 6 }] },
          ],
          Message: [2, { id: 10, text: 6 }, ["Node"]],
        },
      },
    },
  ],
} as unknown as DocumentNode<
  ApolloClientIntegrationTestMessageCreatedSubscription,
  ApolloClientIntegrationTestMessageCreatedSubscriptionVariables
>;
(CacheTestConversationKeyFieldsDocument as any).__relay = (function () {
  var v0 = {
      defaultValue: null,
      kind: "LocalArgument",
      name: "callerInfo",
    },
    v1 = {
      defaultValue: null,
      kind: "LocalArgument",
      name: "id",
    },
    v2 = [
      {
        alias: null,
        args: [
          {
            kind: "Variable",
            name: "callerInfo",
            variableName: "callerInfo",
          },
          {
            kind: "Variable",
            name: "id",
            variableName: "id",
          },
        ],
        concreteType: "Conversation",
        kind: "LinkedField",
        name: "conversationWithGarbage",
        plural: false,
        selections: [
          {
            alias: null,
            args: null,
            kind: "ScalarField",
            name: "id",
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: "ScalarField",
            name: "title",
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: "ScalarField",
            name: "__typename",
            storageKey: null,
          },
        ],
        storageKey: null,
      },
    ];
  return {
    fragment: {
      argumentDefinitions: [v0 /*: any*/, v1 /*: any*/],
      kind: "Fragment",
      metadata: null,
      name: "CacheTestConversationKeyFields",
      selections: v2 /*: any*/,
      type: "Query",
      abstractKey: null,
    },
    kind: "Request",
    operation: {
      argumentDefinitions: [v1 /*: any*/, v0 /*: any*/],
      kind: "Operation",
      name: "CacheTestConversationKeyFields",
      selections: v2 /*: any*/,
    },
    params: {
      cacheID: "0f35d9af8f2c193d715353d2490f5e47",
      metadata: {},
      name: "CacheTestConversationKeyFields",
      operationKind: "query",
      text: null,
    },
  };
})();
(CacheTestConversationKeyFieldsDocument as any).__relay.hash =
  "0f35d9af8f2c193d715353d2490f5e47";
(CacheTestConversationKeyFieldsWithConnectionLikeDocument as any).__relay =
  (function () {
    var v0 = {
        defaultValue: null,
        kind: "LocalArgument",
        name: "after",
      },
      v1 = {
        defaultValue: null,
        kind: "LocalArgument",
        name: "callerInfo",
      },
      v2 = {
        defaultValue: null,
        kind: "LocalArgument",
        name: "first",
      },
      v3 = {
        defaultValue: null,
        kind: "LocalArgument",
        name: "id",
      },
      v4 = {
        defaultValue: null,
        kind: "LocalArgument",
        name: "sort",
      },
      v5 = {
        alias: null,
        args: null,
        kind: "ScalarField",
        name: "id",
        storageKey: null,
      },
      v6 = {
        alias: null,
        args: null,
        kind: "ScalarField",
        name: "__typename",
        storageKey: null,
      },
      v7 = [
        {
          alias: null,
          args: [
            {
              kind: "Variable",
              name: "id",
              variableName: "id",
            },
          ],
          concreteType: "Conversation",
          kind: "LinkedField",
          name: "conversation",
          plural: false,
          selections: [
            v5 /*: any*/,
            {
              alias: null,
              args: null,
              kind: "ScalarField",
              name: "title",
              storageKey: null,
            },
            {
              alias: null,
              args: [
                {
                  kind: "Variable",
                  name: "after",
                  variableName: "after",
                },
                {
                  kind: "Variable",
                  name: "callerInfo",
                  variableName: "callerInfo",
                },
                {
                  kind: "Variable",
                  name: "first",
                  variableName: "first",
                },
                {
                  kind: "Variable",
                  name: "sort",
                  variableName: "sort",
                },
              ],
              concreteType: "MessagesConnection",
              kind: "LinkedField",
              name: "messagesWithExtraField",
              plural: false,
              selections: [
                {
                  alias: null,
                  args: null,
                  concreteType: "MessagesConnectionEdge",
                  kind: "LinkedField",
                  name: "edges",
                  plural: true,
                  selections: [
                    {
                      alias: null,
                      args: null,
                      concreteType: "Message",
                      kind: "LinkedField",
                      name: "node",
                      plural: false,
                      selections: [v5 /*: any*/, v6 /*: any*/],
                      storageKey: null,
                    },
                    v6 /*: any*/,
                  ],
                  storageKey: null,
                },
                v6 /*: any*/,
              ],
              storageKey: null,
            },
            v6 /*: any*/,
          ],
          storageKey: null,
        },
      ];
    return {
      fragment: {
        argumentDefinitions: [
          v0 /*: any*/,
          v1 /*: any*/,
          v2 /*: any*/,
          v3 /*: any*/,
          v4 /*: any*/,
        ],
        kind: "Fragment",
        metadata: null,
        name: "CacheTestConversationKeyFieldsWithConnectionLike",
        selections: v7 /*: any*/,
        type: "Query",
        abstractKey: null,
      },
      kind: "Request",
      operation: {
        argumentDefinitions: [
          v3 /*: any*/,
          v2 /*: any*/,
          v0 /*: any*/,
          v4 /*: any*/,
          v1 /*: any*/,
        ],
        kind: "Operation",
        name: "CacheTestConversationKeyFieldsWithConnectionLike",
        selections: v7 /*: any*/,
      },
      params: {
        cacheID: "f40487670d51d53f75cce390a0c0ec81",
        metadata: {},
        name: "CacheTestConversationKeyFieldsWithConnectionLike",
        operationKind: "query",
        text: null,
      },
    };
  })();
(CacheTestConversationKeyFieldsWithConnectionLikeDocument as any).__relay.hash =
  "f40487670d51d53f75cce390a0c0ec81";
(CacheTestConversationKeyFieldsWithGarbageInputDocument as any).__relay =
  (function () {
    var v0 = {
        defaultValue: null,
        kind: "LocalArgument",
        name: "callerInfo",
      },
      v1 = {
        defaultValue: null,
        kind: "LocalArgument",
        name: "id",
      },
      v2 = {
        defaultValue: null,
        kind: "LocalArgument",
        name: "moreCallerInfo",
      },
      v3 = [
        {
          alias: null,
          args: [
            {
              fields: [
                {
                  kind: "Variable",
                  name: "callerInfo",
                  variableName: "callerInfo",
                },
                {
                  kind: "Variable",
                  name: "id",
                  variableName: "id",
                },
              ],
              kind: "ObjectValue",
              name: "input",
            },
            {
              kind: "Variable",
              name: "moreCallerInfo",
              variableName: "moreCallerInfo",
            },
          ],
          concreteType: "Conversation",
          kind: "LinkedField",
          name: "conversationWithNested",
          plural: false,
          selections: [
            {
              alias: null,
              args: null,
              kind: "ScalarField",
              name: "id",
              storageKey: null,
            },
            {
              alias: null,
              args: null,
              kind: "ScalarField",
              name: "title",
              storageKey: null,
            },
            {
              alias: null,
              args: null,
              kind: "ScalarField",
              name: "__typename",
              storageKey: null,
            },
          ],
          storageKey: null,
        },
      ];
    return {
      fragment: {
        argumentDefinitions: [v0 /*: any*/, v1 /*: any*/, v2 /*: any*/],
        kind: "Fragment",
        metadata: null,
        name: "CacheTestConversationKeyFieldsWithGarbageInput",
        selections: v3 /*: any*/,
        type: "Query",
        abstractKey: null,
      },
      kind: "Request",
      operation: {
        argumentDefinitions: [v1 /*: any*/, v0 /*: any*/, v2 /*: any*/],
        kind: "Operation",
        name: "CacheTestConversationKeyFieldsWithGarbageInput",
        selections: v3 /*: any*/,
      },
      params: {
        cacheID: "714ff55dc670e49b6cc45ddcc3b70e52",
        metadata: {},
        name: "CacheTestConversationKeyFieldsWithGarbageInput",
        operationKind: "query",
        text: null,
      },
    };
  })();
(CacheTestConversationKeyFieldsWithGarbageInputDocument as any).__relay.hash =
  "714ff55dc670e49b6cc45ddcc3b70e52";
(CacheTestConversationKeyFieldsWithGarbageInputOneVarDocument as any).__relay =
  (function () {
    var v0 = [
        {
          defaultValue: null,
          kind: "LocalArgument",
          name: "filter",
        },
        {
          defaultValue: null,
          kind: "LocalArgument",
          name: "moreCallerInfo",
        },
      ],
      v1 = [
        {
          alias: null,
          args: [
            {
              kind: "Variable",
              name: "input",
              variableName: "filter",
            },
            {
              kind: "Variable",
              name: "moreCallerInfo",
              variableName: "moreCallerInfo",
            },
          ],
          concreteType: "Conversation",
          kind: "LinkedField",
          name: "conversationWithNested",
          plural: false,
          selections: [
            {
              alias: null,
              args: null,
              kind: "ScalarField",
              name: "id",
              storageKey: null,
            },
            {
              alias: null,
              args: null,
              kind: "ScalarField",
              name: "title",
              storageKey: null,
            },
            {
              alias: null,
              args: null,
              kind: "ScalarField",
              name: "__typename",
              storageKey: null,
            },
          ],
          storageKey: null,
        },
      ];
    return {
      fragment: {
        argumentDefinitions: v0 /*: any*/,
        kind: "Fragment",
        metadata: null,
        name: "CacheTestConversationKeyFieldsWithGarbageInputOneVar",
        selections: v1 /*: any*/,
        type: "Query",
        abstractKey: null,
      },
      kind: "Request",
      operation: {
        argumentDefinitions: v0 /*: any*/,
        kind: "Operation",
        name: "CacheTestConversationKeyFieldsWithGarbageInputOneVar",
        selections: v1 /*: any*/,
      },
      params: {
        cacheID: "934a4a865d1a89ab05f45810c8c7de39",
        metadata: {},
        name: "CacheTestConversationKeyFieldsWithGarbageInputOneVar",
        operationKind: "query",
        text: null,
      },
    };
  })();
(
  CacheTestConversationKeyFieldsWithGarbageInputOneVarDocument as any
).__relay.hash = "934a4a865d1a89ab05f45810c8c7de39";
(CacheTestMessageQueryDocument as any).__relay = (function () {
  var v0 = [
      {
        defaultValue: null,
        kind: "LocalArgument",
        name: "id",
      },
    ],
    v1 = [
      {
        alias: null,
        args: [
          {
            kind: "Variable",
            name: "messageId",
            variableName: "id",
          },
        ],
        concreteType: "Message",
        kind: "LinkedField",
        name: "message",
        plural: false,
        selections: [
          {
            alias: null,
            args: null,
            kind: "ScalarField",
            name: "id",
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: "ScalarField",
            name: "text",
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: "ScalarField",
            name: "__typename",
            storageKey: null,
          },
        ],
        storageKey: null,
      },
    ];
  return {
    fragment: {
      argumentDefinitions: v0 /*: any*/,
      kind: "Fragment",
      metadata: null,
      name: "CacheTestMessageQuery",
      selections: v1 /*: any*/,
      type: "Query",
      abstractKey: null,
    },
    kind: "Request",
    operation: {
      argumentDefinitions: v0 /*: any*/,
      kind: "Operation",
      name: "CacheTestMessageQuery",
      selections: v1 /*: any*/,
    },
    params: {
      cacheID: "93e521a727fe591c031511104268d32d",
      metadata: {},
      name: "CacheTestMessageQuery",
      operationKind: "query",
      text: null,
    },
  };
})();
(CacheTestMessageQueryDocument as any).__relay.hash =
  "93e521a727fe591c031511104268d32d";
(CacheTestQueryDocument as any).__relay = (function () {
  var v0 = [
      {
        defaultValue: null,
        kind: "LocalArgument",
        name: "conversationId",
      },
      {
        defaultValue: false,
        kind: "LocalArgument",
        name: "includeNestedData",
      },
    ],
    v1 = {
      alias: null,
      args: null,
      kind: "ScalarField",
      name: "id",
      storageKey: null,
    },
    v2 = {
      alias: null,
      args: null,
      kind: "ScalarField",
      name: "__typename",
      storageKey: null,
    },
    v3 = [
      {
        alias: null,
        args: [
          {
            kind: "Variable",
            name: "id",
            variableName: "conversationId",
          },
        ],
        concreteType: "Conversation",
        kind: "LinkedField",
        name: "conversation",
        plural: false,
        selections: [
          v1 /*: any*/,
          {
            alias: null,
            args: null,
            kind: "ScalarField",
            name: "title",
            storageKey: null,
          },
          v2 /*: any*/,
          {
            condition: "includeNestedData",
            kind: "Condition",
            passingValue: true,
            selections: [
              {
                alias: null,
                args: [
                  {
                    kind: "Literal",
                    name: "first",
                    value: 10,
                  },
                ],
                concreteType: "MessagesConnection",
                kind: "LinkedField",
                name: "messages",
                plural: false,
                selections: [
                  {
                    alias: null,
                    args: null,
                    concreteType: "MessagesConnectionEdge",
                    kind: "LinkedField",
                    name: "edges",
                    plural: true,
                    selections: [
                      {
                        alias: null,
                        args: null,
                        concreteType: "Message",
                        kind: "LinkedField",
                        name: "node",
                        plural: false,
                        selections: [
                          v1 /*: any*/,
                          {
                            alias: null,
                            args: null,
                            kind: "ScalarField",
                            name: "authorId",
                            storageKey: null,
                          },
                          {
                            alias: null,
                            args: null,
                            kind: "ScalarField",
                            name: "text",
                            storageKey: null,
                          },
                          {
                            alias: null,
                            args: null,
                            kind: "ScalarField",
                            name: "createdAt",
                            storageKey: null,
                          },
                          v2 /*: any*/,
                        ],
                        storageKey: null,
                      },
                      v2 /*: any*/,
                    ],
                    storageKey: null,
                  },
                  v2 /*: any*/,
                ],
                storageKey: "messages(first:10)",
              },
            ],
          },
        ],
        storageKey: null,
      },
    ];
  return {
    fragment: {
      argumentDefinitions: v0 /*: any*/,
      kind: "Fragment",
      metadata: null,
      name: "CacheTestQuery",
      selections: v3 /*: any*/,
      type: "Query",
      abstractKey: null,
    },
    kind: "Request",
    operation: {
      argumentDefinitions: v0 /*: any*/,
      kind: "Operation",
      name: "CacheTestQuery",
      selections: v3 /*: any*/,
    },
    params: {
      cacheID: "5798e3e323d1f1cd5132ebc2754202f3",
      metadata: {},
      name: "CacheTestQuery",
      operationKind: "query",
      text: null,
    },
  };
})();
(CacheTestQueryDocument as any).__relay.hash =
  "5798e3e323d1f1cd5132ebc2754202f3";
(ApolloClientIntegrationTestQueryDocument as any).__relay = (function () {
  var v0 = {
      defaultValue: null,
      kind: "LocalArgument",
      name: "cursor",
    },
    v1 = {
      defaultValue: null,
      kind: "LocalArgument",
      name: "id",
    },
    v2 = [
      {
        kind: "Variable",
        name: "id",
        variableName: "id",
      },
    ],
    v3 = {
      alias: null,
      args: null,
      kind: "ScalarField",
      name: "__typename",
      storageKey: null,
    },
    v4 = {
      alias: null,
      args: null,
      kind: "ScalarField",
      name: "id",
      storageKey: null,
    },
    v5 = {
      alias: null,
      args: null,
      kind: "ScalarField",
      name: "title",
      storageKey: null,
    },
    v6 = [
      {
        alias: null,
        args: null,
        concreteType: "PageInfo",
        kind: "LinkedField",
        name: "pageInfo",
        plural: false,
        selections: [
          {
            alias: null,
            args: null,
            kind: "ScalarField",
            name: "hasNextPage",
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: "ScalarField",
            name: "endCursor",
            storageKey: null,
          },
          v3 /*: any*/,
        ],
        storageKey: null,
      },
      {
        alias: null,
        args: null,
        concreteType: "MessagesConnectionEdge",
        kind: "LinkedField",
        name: "edges",
        plural: true,
        selections: [
          {
            alias: null,
            args: null,
            kind: "ScalarField",
            name: "cursor",
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            concreteType: "Message",
            kind: "LinkedField",
            name: "node",
            plural: false,
            selections: [
              v3 /*: any*/,
              v4 /*: any*/,
              {
                alias: null,
                args: null,
                kind: "ScalarField",
                name: "text",
                storageKey: null,
              },
            ],
            storageKey: null,
          },
          v3 /*: any*/,
        ],
        storageKey: null,
      },
      v3 /*: any*/,
    ],
    v7 = [
      {
        kind: "Variable",
        name: "after",
        variableName: "cursor",
      },
      {
        kind: "Literal",
        name: "first",
        value: 10,
      },
    ];
  return {
    fragment: {
      argumentDefinitions: [v0 /*: any*/, v1 /*: any*/],
      kind: "Fragment",
      metadata: null,
      name: "ApolloClientIntegrationTestQuery",
      selections: [
        {
          alias: null,
          args: v2 /*: any*/,
          concreteType: "Conversation",
          kind: "LinkedField",
          name: "conversation",
          plural: false,
          selections: [
            v3 /*: any*/,
            v4 /*: any*/,
            v5 /*: any*/,
            {
              alias: "messages",
              args: null,
              concreteType: "MessagesConnection",
              kind: "LinkedField",
              name: "__IntegrationTest_messages_connection",
              plural: false,
              selections: v6 /*: any*/,
              storageKey: null,
            },
          ],
          storageKey: null,
        },
      ],
      type: "Query",
      abstractKey: null,
    },
    kind: "Request",
    operation: {
      argumentDefinitions: [v1 /*: any*/, v0 /*: any*/],
      kind: "Operation",
      name: "ApolloClientIntegrationTestQuery",
      selections: [
        {
          alias: null,
          args: v2 /*: any*/,
          concreteType: "Conversation",
          kind: "LinkedField",
          name: "conversation",
          plural: false,
          selections: [
            v3 /*: any*/,
            v4 /*: any*/,
            v5 /*: any*/,
            {
              alias: null,
              args: v7 /*: any*/,
              concreteType: "MessagesConnection",
              kind: "LinkedField",
              name: "messages",
              plural: false,
              selections: v6 /*: any*/,
              storageKey: null,
            },
            {
              alias: null,
              args: v7 /*: any*/,
              filters: null,
              handle: "connection",
              key: "IntegrationTest_messages",
              kind: "LinkedHandle",
              name: "messages",
            },
          ],
          storageKey: null,
        },
      ],
    },
    params: {
      cacheID: "346f76ab523d3fbc64255f0891256273",
      metadata: {
        connection: [
          {
            count: null,
            cursor: "cursor",
            direction: "forward",
            path: ["conversation", "messages"],
          },
        ],
      },
      name: "ApolloClientIntegrationTestQuery",
      operationKind: "query",
      text: null,
    },
  };
})();
(ApolloClientIntegrationTestQueryDocument as any).__relay.hash =
  "346f76ab523d3fbc64255f0891256273";
(ApolloClientIntegrationTestMutationDocument as any).__relay = (function () {
  var v0 = [
      {
        defaultValue: null,
        kind: "LocalArgument",
        name: "id",
      },
      {
        defaultValue: null,
        kind: "LocalArgument",
        name: "title",
      },
    ],
    v1 = [
      {
        alias: null,
        args: [
          {
            kind: "Variable",
            name: "id",
            variableName: "id",
          },
          {
            kind: "Variable",
            name: "title",
            variableName: "title",
          },
        ],
        concreteType: "Conversation",
        kind: "LinkedField",
        name: "updateConversation",
        plural: false,
        selections: [
          {
            alias: null,
            args: null,
            kind: "ScalarField",
            name: "__typename",
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: "ScalarField",
            name: "id",
            storageKey: null,
          },
          {
            alias: null,
            args: null,
            kind: "ScalarField",
            name: "title",
            storageKey: null,
          },
        ],
        storageKey: null,
      },
    ];
  return {
    fragment: {
      argumentDefinitions: v0 /*: any*/,
      kind: "Fragment",
      metadata: null,
      name: "ApolloClientIntegrationTestMutation",
      selections: v1 /*: any*/,
      type: "Mutation",
      abstractKey: null,
    },
    kind: "Request",
    operation: {
      argumentDefinitions: v0 /*: any*/,
      kind: "Operation",
      name: "ApolloClientIntegrationTestMutation",
      selections: v1 /*: any*/,
    },
    params: {
      cacheID: "5acee6fe38dfd1e26c5664267a7bbc0e",
      metadata: {},
      name: "ApolloClientIntegrationTestMutation",
      operationKind: "mutation",
      text: null,
    },
  };
})();
(ApolloClientIntegrationTestMutationDocument as any).__relay.hash =
  "5acee6fe38dfd1e26c5664267a7bbc0e";
(ApolloClientIntegrationTestCreateMessageMutationDocument as any).__relay =
  (function () {
    var v0 = [
        {
          defaultValue: null,
          kind: "LocalArgument",
          name: "conversationId",
        },
      ],
      v1 = [
        {
          alias: null,
          args: [
            {
              kind: "Variable",
              name: "conversationId",
              variableName: "conversationId",
            },
          ],
          concreteType: "Message",
          kind: "LinkedField",
          name: "createMessage",
          plural: false,
          selections: [
            {
              alias: null,
              args: null,
              kind: "ScalarField",
              name: "__typename",
              storageKey: null,
            },
            {
              alias: null,
              args: null,
              kind: "ScalarField",
              name: "id",
              storageKey: null,
            },
            {
              alias: null,
              args: null,
              kind: "ScalarField",
              name: "text",
              storageKey: null,
            },
          ],
          storageKey: null,
        },
      ];
    return {
      fragment: {
        argumentDefinitions: v0 /*: any*/,
        kind: "Fragment",
        metadata: null,
        name: "ApolloClientIntegrationTestCreateMessageMutation",
        selections: v1 /*: any*/,
        type: "Mutation",
        abstractKey: null,
      },
      kind: "Request",
      operation: {
        argumentDefinitions: v0 /*: any*/,
        kind: "Operation",
        name: "ApolloClientIntegrationTestCreateMessageMutation",
        selections: v1 /*: any*/,
      },
      params: {
        cacheID: "eb72077c8db0425239fbab1f2ba870b6",
        metadata: {},
        name: "ApolloClientIntegrationTestCreateMessageMutation",
        operationKind: "mutation",
        text: null,
      },
    };
  })();
(ApolloClientIntegrationTestCreateMessageMutationDocument as any).__relay.hash =
  "eb72077c8db0425239fbab1f2ba870b6";
(
  ApolloClientIntegrationTestConversationUpdatedSubscriptionDocument as any
).__relay = (function () {
  var v0 = [
    {
      alias: null,
      args: null,
      concreteType: "Conversation",
      kind: "LinkedField",
      name: "conversationUpdated",
      plural: false,
      selections: [
        {
          alias: null,
          args: null,
          kind: "ScalarField",
          name: "__typename",
          storageKey: null,
        },
        {
          alias: null,
          args: null,
          kind: "ScalarField",
          name: "id",
          storageKey: null,
        },
        {
          alias: null,
          args: null,
          kind: "ScalarField",
          name: "title",
          storageKey: null,
        },
      ],
      storageKey: null,
    },
  ];
  return {
    fragment: {
      argumentDefinitions: [],
      kind: "Fragment",
      metadata: null,
      name: "ApolloClientIntegrationTestConversationUpdatedSubscription",
      selections: v0 /*: any*/,
      type: "Subscription",
      abstractKey: null,
    },
    kind: "Request",
    operation: {
      argumentDefinitions: [],
      kind: "Operation",
      name: "ApolloClientIntegrationTestConversationUpdatedSubscription",
      selections: v0 /*: any*/,
    },
    params: {
      cacheID: "0391827416e2014e9019f1df748963bf",
      metadata: {},
      name: "ApolloClientIntegrationTestConversationUpdatedSubscription",
      operationKind: "subscription",
      text: null,
    },
  };
})();
(
  ApolloClientIntegrationTestConversationUpdatedSubscriptionDocument as any
).__relay.hash = "0391827416e2014e9019f1df748963bf";
(ApolloClientIntegrationTestMessageCreatedSubscriptionDocument as any).__relay =
  (function () {
    var v0 = [
        {
          defaultValue: null,
          kind: "LocalArgument",
          name: "conversationId",
        },
      ],
      v1 = [
        {
          alias: null,
          args: [
            {
              kind: "Variable",
              name: "conversationId",
              variableName: "conversationId",
            },
          ],
          concreteType: "Message",
          kind: "LinkedField",
          name: "messageCreated",
          plural: false,
          selections: [
            {
              alias: null,
              args: null,
              kind: "ScalarField",
              name: "__typename",
              storageKey: null,
            },
            {
              alias: null,
              args: null,
              kind: "ScalarField",
              name: "id",
              storageKey: null,
            },
            {
              alias: null,
              args: null,
              kind: "ScalarField",
              name: "text",
              storageKey: null,
            },
          ],
          storageKey: null,
        },
      ];
    return {
      fragment: {
        argumentDefinitions: v0 /*: any*/,
        kind: "Fragment",
        metadata: null,
        name: "ApolloClientIntegrationTestMessageCreatedSubscription",
        selections: v1 /*: any*/,
        type: "Subscription",
        abstractKey: null,
      },
      kind: "Request",
      operation: {
        argumentDefinitions: v0 /*: any*/,
        kind: "Operation",
        name: "ApolloClientIntegrationTestMessageCreatedSubscription",
        selections: v1 /*: any*/,
      },
      params: {
        cacheID: "c8266ff3a7444766771efa2046974854",
        metadata: {},
        name: "ApolloClientIntegrationTestMessageCreatedSubscription",
        operationKind: "subscription",
        text: null,
      },
    };
  })();
(
  ApolloClientIntegrationTestMessageCreatedSubscriptionDocument as any
).__relay.hash = "c8266ff3a7444766771efa2046974854";
(CacheTestFragment as any).__relay = {
  argumentDefinitions: [],
  kind: "Fragment",
  metadata: null,
  name: "CacheTestFragment",
  selections: [
    {
      alias: null,
      args: null,
      kind: "ScalarField",
      name: "id",
      storageKey: null,
    },
    {
      alias: null,
      args: null,
      kind: "ScalarField",
      name: "title",
      storageKey: null,
    },
    {
      alias: null,
      args: null,
      kind: "ScalarField",
      name: "__typename",
      storageKey: null,
    },
  ],
  type: "Conversation",
  abstractKey: null,
};
(CacheTestFragment as any).__relay.hash = "2422c9a6443eb2bb444fe2aed19d30b1";
(CacheTestMessageFragment as any).__relay = {
  argumentDefinitions: [],
  kind: "Fragment",
  metadata: null,
  name: "CacheTestMessageFragment",
  selections: [
    {
      alias: null,
      args: null,
      kind: "ScalarField",
      name: "id",
      storageKey: null,
    },
    {
      alias: null,
      args: null,
      kind: "ScalarField",
      name: "text",
      storageKey: null,
    },
    {
      alias: null,
      args: null,
      kind: "ScalarField",
      name: "__typename",
      storageKey: null,
    },
  ],
  type: "Message",
  abstractKey: null,
};
(CacheTestMessageFragment as any).__relay.hash =
  "35e09585ad08828cac27df4e00748495";
(ApolloClientIntegrationTestMessageFragment as any).__relay = {
  argumentDefinitions: [],
  kind: "Fragment",
  metadata: null,
  name: "ApolloClientIntegrationTestMessageFragment",
  selections: [
    {
      alias: null,
      args: null,
      kind: "ScalarField",
      name: "__typename",
      storageKey: null,
    },
    {
      alias: null,
      args: null,
      kind: "ScalarField",
      name: "id",
      storageKey: null,
    },
    {
      alias: null,
      args: null,
      kind: "ScalarField",
      name: "text",
      storageKey: null,
    },
  ],
  type: "Message",
  abstractKey: null,
};
(ApolloClientIntegrationTestMessageFragment as any).__relay.hash =
  "23b8d08c9cc9330e87e5a823e658754d";
