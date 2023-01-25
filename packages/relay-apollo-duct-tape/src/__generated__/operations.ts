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
}>;

export type ApolloClientIntegrationTestQuery = { __typename?: "Query" } & {
  conversation: { __typename: "Conversation" } & Pick<
    Conversation,
    "id" | "title"
  > & {
      messages: { __typename?: "MessagesConnection" } & {
        edges: Array<
          { __typename?: "MessagesConnectionEdge" } & {
            node: { __typename: "Message" } & Pick<Message, "id" | "text">;
          }
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
      name: "title",
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
          v2 /*: any*/,
          {
            condition: "includeNestedData",
            kind: "Condition",
            passingValue: true,
            selections: [
              {
                kind: "InlineFragment",
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
                type: "Conversation",
                abstractKey: null,
              },
            ],
          },
          {
            kind: "InlineFragment",
            selections: [v1 /*: any*/, v2 /*: any*/],
            type: "Conversation",
            abstractKey: null,
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
      cacheID: "d41d8cd98f00b204e9800998ecf8427e",
      metadata: {},
      name: "CacheTestQuery",
      operationKind: "query",
      text: "",
    },
  };
})();
(CacheTestQueryDocument as any).__relay.hash =
  "810e4a4a96c59a52b8fa84fea9704ed8";
(ApolloClientIntegrationTestQueryDocument as any).__relay = (function () {
  var v0 = [
      {
        defaultValue: null,
        kind: "LocalArgument",
        name: "id",
      },
    ],
    v1 = {
      alias: null,
      args: null,
      kind: "ScalarField",
      name: "__typename",
      storageKey: null,
    },
    v2 = {
      alias: null,
      args: null,
      kind: "ScalarField",
      name: "id",
      storageKey: null,
    },
    v3 = [
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
          v1 /*: any*/,
          v2 /*: any*/,
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
                      v2 /*: any*/,
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
            storageKey: "messages(first:10)",
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
      name: "ApolloClientIntegrationTestQuery",
      selections: v3 /*: any*/,
      type: "Query",
      abstractKey: null,
    },
    kind: "Request",
    operation: {
      argumentDefinitions: v0 /*: any*/,
      kind: "Operation",
      name: "ApolloClientIntegrationTestQuery",
      selections: v3 /*: any*/,
    },
    params: {
      cacheID: "d41d8cd98f00b204e9800998ecf8427e",
      metadata: {},
      name: "ApolloClientIntegrationTestQuery",
      operationKind: "query",
      text: "",
    },
  };
})();
(ApolloClientIntegrationTestQueryDocument as any).__relay.hash =
  "4e849e28e98c020d1ec9e2c875a1dd89";
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
      cacheID: "d41d8cd98f00b204e9800998ecf8427e",
      metadata: {},
      name: "ApolloClientIntegrationTestMutation",
      operationKind: "mutation",
      text: "",
    },
  };
})();
(ApolloClientIntegrationTestMutationDocument as any).__relay.hash =
  "7ce79cf6ef5fc281941a614b5dfef97f";
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
      cacheID: "d41d8cd98f00b204e9800998ecf8427e",
      metadata: {},
      name: "ApolloClientIntegrationTestCreateMessageMutation",
      operationKind: "mutation",
      text: "",
    },
  };
})();
(ApolloClientIntegrationTestCreateMessageMutationDocument as any).__relay.hash =
  "7101b56a6c2cca01c39c8ee0781e4e04";
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
      cacheID: "d41d8cd98f00b204e9800998ecf8427e",
      metadata: {},
      name: "ApolloClientIntegrationTestConversationUpdatedSubscription",
      operationKind: "subscription",
      text: "",
    },
  };
})();
(ApolloClientIntegrationTestConversationUpdatedSubscriptionDocument as any).__relay.hash =
  "26a449e1501df5ec8cf8b1a9c1d8200c";
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
      cacheID: "d41d8cd98f00b204e9800998ecf8427e",
      metadata: {},
      name: "ApolloClientIntegrationTestMessageCreatedSubscription",
      operationKind: "subscription",
      text: "",
    },
  };
})();
(ApolloClientIntegrationTestMessageCreatedSubscriptionDocument as any).__relay.hash =
  "ec565d5106f4c7fd302013f1d5b33fa0";
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
