/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type SortDirection = "ASC" | "DESC";
export type SortField = "CREATED_AT" | "NAME";
export type SortByInput = {
    sortDirection: SortDirection;
    sortField: SortField;
};
export type compiledHooks_ForwardPaginationFragment_PaginationQueryVariables = {
    addExtra: boolean;
    avatarSize: number;
    conversationsAfterCursor: string;
    conversationsForwardCount: number;
    messagesBackwardCount: number;
    messagesBeforeCursor: string;
    sortBy?: SortByInput | null | undefined;
    id: string;
};
export type compiledHooks_ForwardPaginationFragment_PaginationQueryResponse = {
    readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"compiledHooks_ForwardPaginationFragment">;
    } | null;
};
export type compiledHooks_ForwardPaginationFragment_PaginationQuery = {
    readonly response: compiledHooks_ForwardPaginationFragment_PaginationQueryResponse;
    readonly variables: compiledHooks_ForwardPaginationFragment_PaginationQueryVariables;
};


/*
query compiledHooks_ForwardPaginationFragment_PaginationQuery($avatarSize: Int!, $conversationsAfterCursor: String! = "", $conversationsForwardCount: Int! = 1, $messagesBackwardCount: Int!, $messagesBeforeCursor: String!, $sortBy: SortByInput = {sortField: NAME, sortDirection: ASC}, $id: ID!) {
  node(id: $id) {
    __typename
    ...compiledHooks_ForwardPaginationFragment_2AFkol
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

fragment compiledHooks_ForwardPaginationFragment_2AFkol on NodeWithPetAvatarAndConversations {
  __isNodeWithPetAvatarAndConversations: __typename
  petName
  avatarUrl(size: $avatarSize)
  conversations(
    first: $conversationsForwardCount
    after: $conversationsAfterCursor
    sortBy: $sortBy
  ) @connection(key: "compiledHooks_user_conversations", filter: ["sortBy"]) {
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
query compiledHooks_ForwardPaginationFragment_PaginationQuery($avatarSize: Int!, $conversationsAfterCursor: String! = "", $conversationsForwardCount: Int! = 1, $messagesBackwardCount: Int!, $messagesBeforeCursor: String!, $sortBy: SortByInput = {sortField: NAME, sortDirection: ASC}, $id: ID!) {
  node(id: $id) {
    __typename
    ...compiledHooks_ForwardPaginationFragment_2AFkol
    id
    ... on Node {
      __fragments @client
    }
  }
}

fragment compiledHooks_ForwardPaginationFragment_2AFkol on NodeWithPetAvatarAndConversations {
  __isNodeWithPetAvatarAndConversations: __typename
  petName
  avatarUrl(size: $avatarSize)
  conversations(
    first: $conversationsForwardCount
    after: $conversationsAfterCursor
    sortBy: $sortBy
  ) @connection(key: "compiledHooks_user_conversations", filter: ["sortBy"]) {
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
  "value": "sortBy"
},
v9 = {
  "kind": "Variable",
  "name": (v8/*: any*/)
},
v10 = {
  "kind": "Name",
  "value": "id"
},
v11 = {
  "kind": "Variable",
  "name": (v10/*: any*/)
},
v12 = [
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
      "kind": "NamedType",
      "name": {
        "kind": "Name",
        "value": "SortByInput"
      }
    },
    "defaultValue": {
      "kind": "ObjectValue",
      "fields": [
        {
          "kind": "ObjectField",
          "name": {
            "kind": "Name",
            "value": "sortField"
          },
          "value": {
            "kind": "EnumValue",
            "value": "NAME"
          }
        },
        {
          "kind": "ObjectField",
          "name": {
            "kind": "Name",
            "value": "sortDirection"
          },
          "value": {
            "kind": "EnumValue",
            "value": "ASC"
          }
        }
      ]
    }
  },
  {
    "kind": "VariableDefinition",
    "variable": (v11/*: any*/),
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
v13 = {
  "kind": "Name",
  "value": "node"
},
v14 = [
  {
    "kind": "Argument",
    "name": (v10/*: any*/),
    "value": (v11/*: any*/)
  }
],
v15 = {
  "kind": "Name",
  "value": "__typename"
},
v16 = {
  "kind": "Field",
  "name": (v15/*: any*/)
},
v17 = {
  "kind": "Name",
  "value": "compiledHooks_ForwardPaginationFragment_2AFkol"
},
v18 = {
  "kind": "FragmentSpread",
  "name": (v17/*: any*/)
},
v19 = {
  "kind": "Field",
  "name": (v10/*: any*/)
},
v20 = {
  "kind": "Name",
  "value": "compiledHooks_BackwardPaginationFragment"
},
v21 = {
  "kind": "Name",
  "value": "connection"
},
v22 = {
  "kind": "Name",
  "value": "key"
},
v23 = {
  "kind": "Name",
  "value": "edges"
},
v24 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "cursor"
  }
},
v25 = {
  "kind": "Name",
  "value": "pageInfo"
},
v26 = {
  "kind": "NamedType",
  "name": {
    "kind": "Name",
    "value": "NodeWithPetAvatarAndConversations"
  }
},
v27 = {
  "kind": "Field",
  "alias": {
    "kind": "Name",
    "value": "__isNodeWithPetAvatarAndConversations"
  },
  "name": (v15/*: any*/)
},
v28 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "petName"
  }
},
v29 = {
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
v30 = {
  "kind": "Name",
  "value": "conversations"
},
v31 = [
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
  },
  {
    "kind": "Argument",
    "name": (v8/*: any*/),
    "value": (v9/*: any*/)
  }
],
v32 = [
  {
    "kind": "Directive",
    "name": (v21/*: any*/),
    "arguments": [
      {
        "kind": "Argument",
        "name": (v22/*: any*/),
        "value": {
          "kind": "StringValue",
          "value": "compiledHooks_user_conversations",
          "block": false
        }
      },
      {
        "kind": "Argument",
        "name": {
          "kind": "Name",
          "value": "filter"
        },
        "value": {
          "kind": "ListValue",
          "values": [
            {
              "kind": "StringValue",
              "value": "sortBy",
              "block": false
            }
          ]
        }
      }
    ]
  }
],
v33 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "title"
  }
},
v34 = {
  "kind": "Field",
  "name": (v25/*: any*/),
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
v35 = {
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
        "variableDefinitions": (v12/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v13/*: any*/),
              "arguments": (v14/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v16/*: any*/),
                  (v18/*: any*/),
                  (v19/*: any*/)
                ]
              }
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v20/*: any*/),
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
                  "name": (v21/*: any*/),
                  "arguments": [
                    {
                      "kind": "Argument",
                      "name": (v22/*: any*/),
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
                    "name": (v23/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": (v13/*: any*/),
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
                              (v19/*: any*/),
                              (v16/*: any*/)
                            ]
                          }
                        },
                        (v24/*: any*/)
                      ]
                    }
                  },
                  {
                    "kind": "Field",
                    "name": (v25/*: any*/),
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
            (v19/*: any*/)
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v17/*: any*/),
        "typeCondition": (v26/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v27/*: any*/),
            (v28/*: any*/),
            (v29/*: any*/),
            {
              "kind": "Field",
              "name": (v30/*: any*/),
              "arguments": (v31/*: any*/),
              "directives": (v32/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": (v23/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": (v13/*: any*/),
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              (v33/*: any*/),
                              {
                                "kind": "FragmentSpread",
                                "name": (v20/*: any*/)
                              },
                              (v19/*: any*/),
                              (v16/*: any*/)
                            ]
                          }
                        },
                        (v24/*: any*/)
                      ]
                    }
                  },
                  (v34/*: any*/)
                ]
              }
            },
            (v19/*: any*/)
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
        "variableDefinitions": (v12/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v13/*: any*/),
              "arguments": (v14/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v16/*: any*/),
                  (v18/*: any*/),
                  (v19/*: any*/),
                  (v35/*: any*/)
                ]
              }
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v17/*: any*/),
        "typeCondition": (v26/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v27/*: any*/),
            (v28/*: any*/),
            (v29/*: any*/),
            {
              "kind": "Field",
              "name": (v30/*: any*/),
              "arguments": (v31/*: any*/),
              "directives": (v32/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": (v23/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": (v13/*: any*/),
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              (v33/*: any*/),
                              (v19/*: any*/),
                              (v16/*: any*/),
                              (v35/*: any*/)
                            ]
                          }
                        },
                        (v24/*: any*/)
                      ]
                    }
                  },
                  (v34/*: any*/)
                ]
              }
            },
            (v19/*: any*/)
          ]
        }
      }
    ]
  },
  "metadata": {
    "rootSelection": "node",
    "mainFragment": {
      "name": "compiledHooks_ForwardPaginationFragment_2AFkol",
      "typeCondition": "NodeWithPetAvatarAndConversations"
    },
    "connection": {
      "selectionPath": [
        "conversations"
      ],
      "forwardCountVariable": "conversationsForwardCount",
      "forwardCursorVariable": "conversationsAfterCursor",
      "filterVariableDefaults": {
        "sortBy": {
          "sortField": "NAME",
          "sortDirection": "ASC"
        }
      }
    }
  }
};
})();

export default documents;