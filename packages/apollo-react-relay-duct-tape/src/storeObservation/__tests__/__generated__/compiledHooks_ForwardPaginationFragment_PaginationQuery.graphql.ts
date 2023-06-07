/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type compiledHooks_ForwardPaginationFragment_PaginationQueryVariables = {
    avatarSize: number;
    conversationsAfterCursor: string;
    conversationsForwardCount: number;
    messagesBackwardCount: number;
    messagesBeforeCursor: string;
    id: string;
};
export type compiledHooks_ForwardPaginationFragment_PaginationQueryResponse = {
    readonly node: {
        readonly " $fragmentRefs": FragmentRefs<"compiledHooks_ForwardPaginationFragment">;
    } | null;
};
export type compiledHooks_ForwardPaginationFragment_PaginationQuery = {
    readonly response: compiledHooks_ForwardPaginationFragment_PaginationQueryResponse;
    readonly variables: compiledHooks_ForwardPaginationFragment_PaginationQueryVariables;
};


/*
query compiledHooks_ForwardPaginationFragment_PaginationQuery($avatarSize: Int!, $conversationsAfterCursor: String! = "", $conversationsForwardCount: Int! = 1, $messagesBackwardCount: Int!, $messagesBeforeCursor: String!, $id: ID!) {
  node(id: $id) {
    __typename
    ...compiledHooks_ForwardPaginationFragment_4o723C
    id
  }
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

fragment compiledHooks_ForwardPaginationFragment_4o723C on User {
  petName
  avatarUrl(size: $avatarSize)
  conversations(
    first: $conversationsForwardCount
    after: $conversationsAfterCursor
  ) @connection(key: "compiledHooks_user_conversations") {
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
*/

/*
query compiledHooks_ForwardPaginationFragment_PaginationQuery($avatarSize: Int!, $conversationsAfterCursor: String! = "", $conversationsForwardCount: Int! = 1, $messagesBackwardCount: Int!, $messagesBeforeCursor: String!, $id: ID!) {
  node(id: $id) {
    __typename
    ...compiledHooks_ForwardPaginationFragment_4o723C
    id
    ... on Node {
      __fragments @client
    }
  }
}

fragment compiledHooks_ForwardPaginationFragment_4o723C on User {
  petName
  avatarUrl(size: $avatarSize)
  conversations(
    first: $conversationsForwardCount
    after: $conversationsAfterCursor
  ) @connection(key: "compiledHooks_user_conversations") {
    edges {
      node {
        title
        id
        __typename
        ... on Node {
          __fragments @client
        }
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
*/

export const documents: import("@graphitation/apollo-react-relay-duct-tape-compiler").CompiledArtefactModule = (function(){
var v0 = {
  "kind": "Name",
  "value": "compiledHooks_ForwardPaginationFragment_PaginationQuery"
},
v1 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "avatarSize"
  }
},
v2 = {
  "kind": "NonNullType",
  "type": {
    "kind": "NamedType",
    "name": {
      "kind": "Name",
      "value": "Int"
    }
  }
},
v3 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "conversationsAfterCursor"
  }
},
v4 = {
  "kind": "NonNullType",
  "type": {
    "kind": "NamedType",
    "name": {
      "kind": "Name",
      "value": "String"
    }
  }
},
v5 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "conversationsForwardCount"
  }
},
v6 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "messagesBackwardCount"
  }
},
v7 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "messagesBeforeCursor"
  }
},
v8 = {
  "kind": "Name",
  "value": "id"
},
v9 = {
  "kind": "Variable",
  "name": (v8/*: any*/)
},
v10 = [
  {
    "kind": "VariableDefinition",
    "variable": (v1/*: any*/),
    "type": (v2/*: any*/)
  },
  {
    "kind": "VariableDefinition",
    "variable": (v3/*: any*/),
    "type": (v4/*: any*/),
    "defaultValue": {
      "kind": "StringValue",
      "value": "",
      "block": false
    }
  },
  {
    "kind": "VariableDefinition",
    "variable": (v5/*: any*/),
    "type": (v2/*: any*/),
    "defaultValue": {
      "kind": "IntValue",
      "value": "1"
    }
  },
  {
    "kind": "VariableDefinition",
    "variable": (v6/*: any*/),
    "type": (v2/*: any*/)
  },
  {
    "kind": "VariableDefinition",
    "variable": (v7/*: any*/),
    "type": (v4/*: any*/)
  },
  {
    "kind": "VariableDefinition",
    "variable": (v9/*: any*/),
    "type": {
      "kind": "NonNullType",
      "type": {
        "kind": "NamedType",
        "name": {
          "kind": "Name",
          "value": "ID"
        }
      }
    }
  }
],
v11 = {
  "kind": "Name",
  "value": "node"
},
v12 = [
  {
    "kind": "Argument",
    "name": (v8/*: any*/),
    "value": (v9/*: any*/)
  }
],
v13 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "__typename"
  }
},
v14 = {
  "kind": "Name",
  "value": "compiledHooks_ForwardPaginationFragment_4o723C"
},
v15 = {
  "kind": "FragmentSpread",
  "name": (v14/*: any*/)
},
v16 = {
  "kind": "Field",
  "name": (v8/*: any*/)
},
v17 = {
  "kind": "Name",
  "value": "compiledHooks_BackwardPaginationFragment"
},
v18 = {
  "kind": "Name",
  "value": "connection"
},
v19 = {
  "kind": "Name",
  "value": "key"
},
v20 = {
  "kind": "Name",
  "value": "edges"
},
v21 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "cursor"
  }
},
v22 = {
  "kind": "Name",
  "value": "pageInfo"
},
v23 = {
  "kind": "NamedType",
  "name": {
    "kind": "Name",
    "value": "User"
  }
},
v24 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "petName"
  }
},
v25 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "avatarUrl"
  },
  "arguments": [
    {
      "kind": "Argument",
      "name": {
        "kind": "Name",
        "value": "size"
      },
      "value": (v1/*: any*/)
    }
  ]
},
v26 = {
  "kind": "Name",
  "value": "conversations"
},
v27 = [
  {
    "kind": "Argument",
    "name": {
      "kind": "Name",
      "value": "first"
    },
    "value": (v5/*: any*/)
  },
  {
    "kind": "Argument",
    "name": {
      "kind": "Name",
      "value": "after"
    },
    "value": (v3/*: any*/)
  }
],
v28 = [
  {
    "kind": "Directive",
    "name": (v18/*: any*/),
    "arguments": [
      {
        "kind": "Argument",
        "name": (v19/*: any*/),
        "value": {
          "kind": "StringValue",
          "value": "compiledHooks_user_conversations",
          "block": false
        }
      }
    ]
  }
],
v29 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "title"
  }
},
v30 = {
  "kind": "Field",
  "name": (v22/*: any*/),
  "selectionSet": {
    "kind": "SelectionSet",
    "selections": [
      {
        "kind": "Field",
        "name": {
          "kind": "Name",
          "value": "endCursor"
        }
      },
      {
        "kind": "Field",
        "name": {
          "kind": "Name",
          "value": "hasNextPage"
        }
      }
    ]
  }
},
v31 = {
  "kind": "InlineFragment",
  "typeCondition": {
    "kind": "NamedType",
    "name": {
      "kind": "Name",
      "value": "Node"
    }
  },
  "selectionSet": {
    "kind": "SelectionSet",
    "selections": [
      {
        "kind": "Field",
        "name": {
          "kind": "Name",
          "value": "__fragments"
        },
        "directives": [
          {
            "kind": "Directive",
            "name": {
              "kind": "Name",
              "value": "client"
            }
          }
        ]
      }
    ]
  }
};
return {
  "executionQueryDocument": {
    "kind": "Document",
    "definitions": [
      {
        "kind": "OperationDefinition",
        "operation": "query",
        "name": (v0/*: any*/),
        "variableDefinitions": (v10/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v11/*: any*/),
              "arguments": (v12/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v13/*: any*/),
                  (v15/*: any*/),
                  (v16/*: any*/)
                ]
              }
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v17/*: any*/),
        "typeCondition": {
          "kind": "NamedType",
          "name": {
            "kind": "Name",
            "value": "Conversation"
          }
        },
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "messages"
              },
              "arguments": [
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "last"
                  },
                  "value": (v6/*: any*/)
                },
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "before"
                  },
                  "value": (v7/*: any*/)
                }
              ],
              "directives": [
                {
                  "kind": "Directive",
                  "name": (v18/*: any*/),
                  "arguments": [
                    {
                      "kind": "Argument",
                      "name": (v19/*: any*/),
                      "value": {
                        "kind": "StringValue",
                        "value": "compiledHooks_conversation_messages",
                        "block": false
                      }
                    }
                  ]
                }
              ],
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": (v20/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": (v11/*: any*/),
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              {
                                "kind": "Field",
                                "name": {
                                  "kind": "Name",
                                  "value": "text"
                                }
                              },
                              (v16/*: any*/),
                              (v13/*: any*/)
                            ]
                          }
                        },
                        (v21/*: any*/)
                      ]
                    }
                  },
                  {
                    "kind": "Field",
                    "name": (v22/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "hasPreviousPage"
                          }
                        },
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "startCursor"
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            },
            (v16/*: any*/)
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v14/*: any*/),
        "typeCondition": (v23/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v24/*: any*/),
            (v25/*: any*/),
            {
              "kind": "Field",
              "name": (v26/*: any*/),
              "arguments": (v27/*: any*/),
              "directives": (v28/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": (v20/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": (v11/*: any*/),
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              (v29/*: any*/),
                              {
                                "kind": "FragmentSpread",
                                "name": (v17/*: any*/)
                              },
                              (v16/*: any*/),
                              (v13/*: any*/)
                            ]
                          }
                        },
                        (v21/*: any*/)
                      ]
                    }
                  },
                  (v30/*: any*/)
                ]
              }
            },
            (v16/*: any*/)
          ]
        }
      }
    ]
  },
  "watchQueryDocument": {
    "kind": "Document",
    "definitions": [
      {
        "kind": "OperationDefinition",
        "operation": "query",
        "name": (v0/*: any*/),
        "variableDefinitions": (v10/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v11/*: any*/),
              "arguments": (v12/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v13/*: any*/),
                  (v15/*: any*/),
                  (v16/*: any*/),
                  (v31/*: any*/)
                ]
              }
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v14/*: any*/),
        "typeCondition": (v23/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v24/*: any*/),
            (v25/*: any*/),
            {
              "kind": "Field",
              "name": (v26/*: any*/),
              "arguments": (v27/*: any*/),
              "directives": (v28/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": (v20/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": (v11/*: any*/),
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              (v29/*: any*/),
                              (v16/*: any*/),
                              (v13/*: any*/),
                              (v31/*: any*/)
                            ]
                          }
                        },
                        (v21/*: any*/)
                      ]
                    }
                  },
                  (v30/*: any*/)
                ]
              }
            },
            (v16/*: any*/)
          ]
        }
      }
    ]
  },
  "metadata": {
    "rootSelection": "node",
    "mainFragment": {
      "name": "compiledHooks_ForwardPaginationFragment_4o723C",
      "typeCondition": "User"
    },
    "connection": {
      "selectionPath": [
        "conversations"
      ],
      "forwardCountVariable": "conversationsForwardCount",
      "forwardCursorVariable": "conversationsAfterCursor"
    }
  }
};
})();