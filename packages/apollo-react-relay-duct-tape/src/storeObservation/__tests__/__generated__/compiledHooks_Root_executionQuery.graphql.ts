/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type compiledHooks_Root_executionQueryVariables = {
  userId: number;
  avatarSize?: number | null | undefined;
  messagesBackwardCount: number;
  messagesBeforeCursor: string;
  id?: string | null | undefined;
};
export type compiledHooks_Root_executionQueryResponse = {
  readonly user: {
    readonly name: string;
    readonly " $fragmentSpreads": FragmentRefs<
      | "compiledHooks_ChildFragment"
      | "compiledHooks_RefetchableFragment"
      | "compiledHooks_ForwardPaginationFragment"
    >;
  };
  readonly " $fragmentSpreads": FragmentRefs<"compiledHooks_QueryTypeFragment">;
};
export type compiledHooks_Root_executionQuery = {
  readonly response: compiledHooks_Root_executionQueryResponse;
  readonly variables: compiledHooks_Root_executionQueryVariables;
};

/*
query compiledHooks_Root_executionQuery($userId: Int!, $avatarSize: Int = 21, $messagesBackwardCount: Int!, $messagesBeforeCursor: String!, $id: String = "shouldNotOverrideCompiledFragmentId") {
  user(id: $userId, idThatDoesntOverride: $id) {
    name
    ...compiledHooks_ChildFragment
    ...compiledHooks_RefetchableFragment
    ...compiledHooks_ForwardPaginationFragment
    id
  }
  ...compiledHooks_QueryTypeFragment
}

fragment compiledHooks_BackwardPaginationFragment on Conversation {
  messages(last: $messagesBackwardCount, before: $messagesBeforeCursor) @connection(key: "compiledHooks_conversation_messages") {
    edges {
      node {
        text
        id
        __typename
      }
      cursor
    }
    pageInfo {
      hasPreviousPage
      startCursor
    }
  }
  id
}

fragment compiledHooks_ChildFragment on User {
  petName
  id
}

fragment compiledHooks_ForwardPaginationFragment on NodeWithPetAvatarAndConversations {
  __isNodeWithPetAvatarAndConversations: __typename
  petName
  avatarUrl(size: $avatarSize)
  conversations(first: 1, after: "") @connection(key: "compiledHooks_user_conversations") {
    edges {
      node {
        title
        ...compiledHooks_BackwardPaginationFragment
        id
        __typename
      }
      cursor
    }
    pageInfo {
      endCursor
      hasNextPage
    }
  }
  id
}

fragment compiledHooks_QueryTypeFragment on Query {
  nonNode {
    id
  }
}

fragment compiledHooks_RefetchableFragment on User {
  petName
  avatarUrl(size: $avatarSize)
  id
}
*/

/*
query compiledHooks_Root_executionQuery($userId: Int!, $avatarSize: Int = 21, $messagesBackwardCount: Int!, $messagesBeforeCursor: String!, $id: String = "shouldNotOverrideCompiledFragmentId") {
  user(id: $userId, idThatDoesntOverride: $id) {
    name
    id
    ... on Node {
      __fragments @client
    }
  }
  __fragments @client
}
*/

export const documents: import("@graphitation/apollo-react-relay-duct-tape-compiler").CompiledArtefactModule =
  (function () {
    var v0 = {
        kind: "Name",
        value: "compiledHooks_Root_executionQuery",
      },
      v1 = {
        kind: "Variable",
        name: {
          kind: "Name",
          value: "userId",
        },
      },
      v2 = {
        kind: "NamedType",
        name: {
          kind: "Name",
          value: "Int",
        },
      },
      v3 = {
        kind: "NonNullType",
        type: v2 /*: any*/,
      },
      v4 = {
        kind: "Variable",
        name: {
          kind: "Name",
          value: "avatarSize",
        },
      },
      v5 = {
        kind: "Variable",
        name: {
          kind: "Name",
          value: "messagesBackwardCount",
        },
      },
      v6 = {
        kind: "Variable",
        name: {
          kind: "Name",
          value: "messagesBeforeCursor",
        },
      },
      v7 = {
        kind: "NamedType",
        name: {
          kind: "Name",
          value: "String",
        },
      },
      v8 = {
        kind: "Name",
        value: "id",
      },
      v9 = {
        kind: "Variable",
        name: v8 /*: any*/,
      },
      v10 = [
        {
          kind: "VariableDefinition",
          variable: v1 /*: any*/,
          type: v3 /*: any*/,
        },
        {
          kind: "VariableDefinition",
          variable: v4 /*: any*/,
          type: v2 /*: any*/,
          defaultValue: {
            kind: "IntValue",
            value: "21",
          },
        },
        {
          kind: "VariableDefinition",
          variable: v5 /*: any*/,
          type: v3 /*: any*/,
        },
        {
          kind: "VariableDefinition",
          variable: v6 /*: any*/,
          type: {
            kind: "NonNullType",
            type: v7 /*: any*/,
          },
        },
        {
          kind: "VariableDefinition",
          variable: v9 /*: any*/,
          type: v7 /*: any*/,
          defaultValue: {
            kind: "StringValue",
            value: "shouldNotOverrideCompiledFragmentId",
            block: false,
          },
        },
      ],
      v11 = {
        kind: "Name",
        value: "user",
      },
      v12 = [
        {
          kind: "Argument",
          name: v8 /*: any*/,
          value: v1 /*: any*/,
        },
        {
          kind: "Argument",
          name: {
            kind: "Name",
            value: "idThatDoesntOverride",
          },
          value: v9 /*: any*/,
        },
      ],
      v13 = {
        kind: "Field",
        name: {
          kind: "Name",
          value: "name",
        },
      },
      v14 = {
        kind: "Name",
        value: "compiledHooks_ChildFragment",
      },
      v15 = {
        kind: "Name",
        value: "compiledHooks_RefetchableFragment",
      },
      v16 = {
        kind: "Name",
        value: "compiledHooks_ForwardPaginationFragment",
      },
      v17 = {
        kind: "Field",
        name: v8 /*: any*/,
      },
      v18 = {
        kind: "Name",
        value: "compiledHooks_QueryTypeFragment",
      },
      v19 = {
        kind: "Name",
        value: "compiledHooks_BackwardPaginationFragment",
      },
      v20 = {
        kind: "Name",
        value: "connection",
      },
      v21 = {
        kind: "Name",
        value: "key",
      },
      v22 = {
        kind: "Name",
        value: "edges",
      },
      v23 = {
        kind: "Name",
        value: "node",
      },
      v24 = {
        kind: "Name",
        value: "__typename",
      },
      v25 = {
        kind: "Field",
        name: v24 /*: any*/,
      },
      v26 = {
        kind: "Field",
        name: {
          kind: "Name",
          value: "cursor",
        },
      },
      v27 = {
        kind: "Name",
        value: "pageInfo",
      },
      v28 = {
        kind: "NamedType",
        name: {
          kind: "Name",
          value: "User",
        },
      },
      v29 = {
        kind: "Field",
        name: {
          kind: "Name",
          value: "petName",
        },
      },
      v30 = {
        kind: "Field",
        name: {
          kind: "Name",
          value: "avatarUrl",
        },
        arguments: [
          {
            kind: "Argument",
            name: {
              kind: "Name",
              value: "size",
            },
            value: v4 /*: any*/,
          },
        ],
      },
      v31 = {
        kind: "Field",
        name: {
          kind: "Name",
          value: "__fragments",
        },
        directives: [
          {
            kind: "Directive",
            name: {
              kind: "Name",
              value: "client",
            },
          },
        ],
      };
    return {
      executionQueryDocument: {
        kind: "Document",
        definitions: [
          {
            kind: "OperationDefinition",
            operation: "query",
            name: v0 /*: any*/,
            variableDefinitions: v10 /*: any*/,
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: v11 /*: any*/,
                  arguments: v12 /*: any*/,
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      v13 /*: any*/,
                      {
                        kind: "FragmentSpread",
                        name: v14 /*: any*/,
                      },
                      {
                        kind: "FragmentSpread",
                        name: v15 /*: any*/,
                      },
                      {
                        kind: "FragmentSpread",
                        name: v16 /*: any*/,
                      },
                      v17 /*: any*/,
                    ],
                  },
                },
                {
                  kind: "FragmentSpread",
                  name: v18 /*: any*/,
                },
              ],
            },
          },
          {
            kind: "FragmentDefinition",
            name: v19 /*: any*/,
            typeCondition: {
              kind: "NamedType",
              name: {
                kind: "Name",
                value: "Conversation",
              },
            },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: {
                    kind: "Name",
                    value: "messages",
                  },
                  arguments: [
                    {
                      kind: "Argument",
                      name: {
                        kind: "Name",
                        value: "last",
                      },
                      value: v5 /*: any*/,
                    },
                    {
                      kind: "Argument",
                      name: {
                        kind: "Name",
                        value: "before",
                      },
                      value: v6 /*: any*/,
                    },
                  ],
                  directives: [
                    {
                      kind: "Directive",
                      name: v20 /*: any*/,
                      arguments: [
                        {
                          kind: "Argument",
                          name: v21 /*: any*/,
                          value: {
                            kind: "StringValue",
                            value: "compiledHooks_conversation_messages",
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
                        name: v22 /*: any*/,
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: v23 /*: any*/,
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  {
                                    kind: "Field",
                                    name: {
                                      kind: "Name",
                                      value: "text",
                                    },
                                  },
                                  v17 /*: any*/,
                                  v25 /*: any*/,
                                ],
                              },
                            },
                            v26 /*: any*/,
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: v27 /*: any*/,
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: {
                                kind: "Name",
                                value: "hasPreviousPage",
                              },
                            },
                            {
                              kind: "Field",
                              name: {
                                kind: "Name",
                                value: "startCursor",
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                v17 /*: any*/,
              ],
            },
          },
          {
            kind: "FragmentDefinition",
            name: v14 /*: any*/,
            typeCondition: v28 /*: any*/,
            selectionSet: {
              kind: "SelectionSet",
              selections: [v29 /*: any*/, v17 /*: any*/],
            },
          },
          {
            kind: "FragmentDefinition",
            name: v16 /*: any*/,
            typeCondition: {
              kind: "NamedType",
              name: {
                kind: "Name",
                value: "NodeWithPetAvatarAndConversations",
              },
            },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  alias: {
                    kind: "Name",
                    value: "__isNodeWithPetAvatarAndConversations",
                  },
                  name: v24 /*: any*/,
                },
                v29 /*: any*/,
                v30 /*: any*/,
                {
                  kind: "Field",
                  name: {
                    kind: "Name",
                    value: "conversations",
                  },
                  arguments: [
                    {
                      kind: "Argument",
                      name: {
                        kind: "Name",
                        value: "first",
                      },
                      value: {
                        kind: "IntValue",
                        value: "1",
                      },
                    },
                    {
                      kind: "Argument",
                      name: {
                        kind: "Name",
                        value: "after",
                      },
                      value: {
                        kind: "StringValue",
                        value: "",
                        block: false,
                      },
                    },
                  ],
                  directives: [
                    {
                      kind: "Directive",
                      name: v20 /*: any*/,
                      arguments: [
                        {
                          kind: "Argument",
                          name: v21 /*: any*/,
                          value: {
                            kind: "StringValue",
                            value: "compiledHooks_user_conversations",
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
                        name: v22 /*: any*/,
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: v23 /*: any*/,
                              selectionSet: {
                                kind: "SelectionSet",
                                selections: [
                                  {
                                    kind: "Field",
                                    name: {
                                      kind: "Name",
                                      value: "title",
                                    },
                                  },
                                  {
                                    kind: "FragmentSpread",
                                    name: v19 /*: any*/,
                                  },
                                  v17 /*: any*/,
                                  v25 /*: any*/,
                                ],
                              },
                            },
                            v26 /*: any*/,
                          ],
                        },
                      },
                      {
                        kind: "Field",
                        name: v27 /*: any*/,
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: {
                                kind: "Name",
                                value: "endCursor",
                              },
                            },
                            {
                              kind: "Field",
                              name: {
                                kind: "Name",
                                value: "hasNextPage",
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                v17 /*: any*/,
              ],
            },
          },
          {
            kind: "FragmentDefinition",
            name: v18 /*: any*/,
            typeCondition: {
              kind: "NamedType",
              name: {
                kind: "Name",
                value: "Query",
              },
            },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: {
                    kind: "Name",
                    value: "nonNode",
                  },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [v17 /*: any*/],
                  },
                },
              ],
            },
          },
          {
            kind: "FragmentDefinition",
            name: v15 /*: any*/,
            typeCondition: v28 /*: any*/,
            selectionSet: {
              kind: "SelectionSet",
              selections: [v29 /*: any*/, v30 /*: any*/, v17 /*: any*/],
            },
          },
        ],
      },
      watchQueryDocument: {
        kind: "Document",
        definitions: [
          {
            kind: "OperationDefinition",
            operation: "query",
            name: v0 /*: any*/,
            variableDefinitions: v10 /*: any*/,
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                {
                  kind: "Field",
                  name: v11 /*: any*/,
                  arguments: v12 /*: any*/,
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      v13 /*: any*/,
                      v17 /*: any*/,
                      {
                        kind: "InlineFragment",
                        typeCondition: {
                          kind: "NamedType",
                          name: {
                            kind: "Name",
                            value: "Node",
                          },
                        },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [v31 /*: any*/],
                        },
                      },
                    ],
                  },
                },
                v31 /*: any*/,
              ],
            },
          },
        ],
      },
    };
  })();

export default documents;
