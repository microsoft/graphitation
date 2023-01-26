import { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> &
  { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> &
  { [SubKey in K]: Maybe<T[SubKey]> };
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
};

export type ConversationMessagesArgs = {
  first: Scalars["Int"];
  after?: InputMaybe<Scalars["String"]>;
  sort?: InputMaybe<Sort>;
};

export type Message = {
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
  node?: Maybe<Node>;
};

export type QueryConversationArgs = {
  id: Scalars["String"];
};

export type QueryNodeArgs = {
  id: Scalars["ID"];
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

export type CacheTestFragment = { __typename?: "Conversation" } & Pick<
  Conversation,
  "id" | "title"
>;

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
          > & { node: { __typename: "Message" } & Pick<Message, "id" | "text"> }
        >;
      };
    };
};

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

export type ApolloClientIntegrationTestConversationUpdatedSubscriptionVariables = Exact<{
  [key: string]: never;
}>;

export type ApolloClientIntegrationTestConversationUpdatedSubscription = {
  __typename?: "Subscription";
} & {
  conversationUpdated: { __typename: "Conversation" } & Pick<
    Conversation,
    "id" | "title"
  >;
};

export type ApolloClientIntegrationTestMessageCreatedSubscriptionVariables = Exact<{
  conversationId: Scalars["String"];
}>;

export type ApolloClientIntegrationTestMessageCreatedSubscription = {
  __typename?: "Subscription";
} & {
  messageCreated: { __typename: "Message" } & Pick<Message, "id" | "text">;
};

export const CacheTestFragment = ({
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
    },
  ],
} as unknown) as DocumentNode<CacheTestFragment, unknown>;
export const CacheTestQueryDocument = ({
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
    },
    ...CacheTestFragment.definitions,
  ],
} as unknown) as DocumentNode<CacheTestQuery, CacheTestQueryVariables>;
export const ApolloClientIntegrationTestQueryDocument = ({
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
                                    kind: "Field",
                                    name: { kind: "Name", value: "__typename" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "id" },
                                  },
                                  {
                                    kind: "Field",
                                    name: { kind: "Name", value: "text" },
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
    },
  ],
} as unknown) as DocumentNode<
  ApolloClientIntegrationTestQuery,
  ApolloClientIntegrationTestQueryVariables
>;
export const ApolloClientIntegrationTestMutationDocument = ({
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
    },
  ],
} as unknown) as DocumentNode<
  ApolloClientIntegrationTestMutation,
  ApolloClientIntegrationTestMutationVariables
>;
export const ApolloClientIntegrationTestCreateMessageMutationDocument = ({
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
    },
  ],
} as unknown) as DocumentNode<
  ApolloClientIntegrationTestCreateMessageMutation,
  ApolloClientIntegrationTestCreateMessageMutationVariables
>;
export const ApolloClientIntegrationTestConversationUpdatedSubscriptionDocument = ({
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
                { kind: "Field", name: { kind: "Name", value: "__typename" } },
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "title" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown) as DocumentNode<
  ApolloClientIntegrationTestConversationUpdatedSubscription,
  ApolloClientIntegrationTestConversationUpdatedSubscriptionVariables
>;
export const ApolloClientIntegrationTestMessageCreatedSubscriptionDocument = ({
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
    },
  ],
} as unknown) as DocumentNode<
  ApolloClientIntegrationTestMessageCreatedSubscription,
  ApolloClientIntegrationTestMessageCreatedSubscriptionVariables
>;
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
    v1 = [
      {
        kind: "Variable",
        name: "id",
        variableName: "conversationId",
      },
    ],
    v2 = {
      alias: null,
      args: null,
      kind: "ScalarField",
      name: "id",
      storageKey: null,
    },
    v3 = {
      alias: null,
      args: null,
      kind: "ScalarField",
      name: "title",
      storageKey: null,
    },
    v4 = {
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
                    v2 /*: any*/,
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
                  ],
                  storageKey: null,
                },
              ],
              storageKey: null,
            },
          ],
          storageKey: "messages(first:10)",
        },
      ],
    };
  return {
    fragment: {
      argumentDefinitions: v0 /*: any*/,
      kind: "Fragment",
      metadata: null,
      name: "CacheTestQuery",
      selections: [
        {
          alias: null,
          args: v1 /*: any*/,
          concreteType: "Conversation",
          kind: "LinkedField",
          name: "conversation",
          plural: false,
          selections: [
            v2 /*: any*/,
            v3 /*: any*/,
            v4 /*: any*/,
            {
              args: null,
              kind: "FragmentSpread",
              name: "CacheTestFragment",
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
      argumentDefinitions: v0 /*: any*/,
      kind: "Operation",
      name: "CacheTestQuery",
      selections: [
        {
          alias: null,
          args: v1 /*: any*/,
          concreteType: "Conversation",
          kind: "LinkedField",
          name: "conversation",
          plural: false,
          selections: [v2 /*: any*/, v3 /*: any*/, v4 /*: any*/],
          storageKey: null,
        },
      ],
    },
    params: {
      cacheID: "c705617444e60065fecf7ecda0ffd951",
      metadata: {},
      name: "CacheTestQuery",
      operationKind: "query",
      text: null,
    },
  };
})();
(CacheTestQueryDocument as any).__relay.hash =
  "c3185cedf1ceb043114847bc95b61cc7";
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
        ],
        storageKey: null,
      },
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
      cacheID: "b6a618a549bc22357ceca576b2c0e3ee",
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
  "0472351d40d3ef4aedae3ca0a4ad327c";
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
  "ca4837d079003e33d1a0ee50db934a89";
(ApolloClientIntegrationTestCreateMessageMutationDocument as any).__relay = (function () {
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
  "926973556b9d94c9b4283bb715df6177";
(ApolloClientIntegrationTestConversationUpdatedSubscriptionDocument as any).__relay = (function () {
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
(ApolloClientIntegrationTestConversationUpdatedSubscriptionDocument as any).__relay.hash =
  "b33aa39746922c98886ade0e7685770d";
(ApolloClientIntegrationTestMessageCreatedSubscriptionDocument as any).__relay = (function () {
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
(ApolloClientIntegrationTestMessageCreatedSubscriptionDocument as any).__relay.hash =
  "588961ccfb24d8a6197b022d1f942d08";
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
  ],
  type: "Conversation",
  abstractKey: null,
};
(CacheTestFragment as any).__relay.hash = "e0c167530d154a384aebedea5a08b577";
