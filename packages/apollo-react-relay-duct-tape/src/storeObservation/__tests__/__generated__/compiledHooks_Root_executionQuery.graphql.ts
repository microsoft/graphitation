/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type compiledHooks_Root_executionQueryVariables = {
    userId: number;
    avatarSize?: number | null | undefined;
    messagesBackwardCount: number;
    messagesBeforeCursor: string;
};
export type compiledHooks_Root_executionQueryResponse = {
    readonly user: {
        readonly name: string;
        readonly " $fragmentRefs": FragmentRefs<"compiledHooks_ChildFragment" | "compiledHooks_RefetchableFragment" | "compiledHooks_ForwardPaginationFragment">;
    };
    readonly " $fragmentRefs": FragmentRefs<"compiledHooks_QueryTypeFragment">;
};
export type compiledHooks_Root_executionQuery = {
    readonly response: compiledHooks_Root_executionQueryResponse;
    readonly variables: compiledHooks_Root_executionQueryVariables;
};


/*
query compiledHooks_Root_executionQuery($userId: Int!, $avatarSize: Int = 21, $messagesBackwardCount: Int!, $messagesBeforeCursor: String!) {
  user(id: $userId) {
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
  ... on Node {
    __isNode: __typename
    id
  }
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
query compiledHooks_Root_executionQuery($userId: Int!, $avatarSize: Int = 21, $messagesBackwardCount: Int!, $messagesBeforeCursor: String!) {
  user(id: $userId) {
    name
    id
    ... on Node {
      __fragments @client
    }
  }
  __fragments @client
}
*/

export const documents: import("@graphitation/apollo-react-relay-duct-tape-compiler").CompiledArtefactModule = (function(){
var v0 = {
  "kind": "Name",
  "value": "compiledHooks_Root_executionQuery"
},
v1 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "userId"
  }
},
v2 = {
  "kind": "NamedType",
  "name": {
    "kind": "Name",
    "value": "Int"
  }
},
v3 = {
  "kind": "NonNullType",
  "type": (v2/*: any*/)
},
v4 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "avatarSize"
  }
},
v5 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "messagesBackwardCount"
  }
},
v6 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "messagesBeforeCursor"
  }
},
v7 = [
  {
    "kind": "VariableDefinition",
    "variable": (v1/*: any*/),
    "type": (v3/*: any*/)
  },
  {
    "kind": "VariableDefinition",
    "variable": (v4/*: any*/),
    "type": (v2/*: any*/),
    "defaultValue": {
      "kind": "IntValue",
      "value": "21"
    }
  },
  {
    "kind": "VariableDefinition",
    "variable": (v5/*: any*/),
    "type": (v3/*: any*/)
  },
  {
    "kind": "VariableDefinition",
    "variable": (v6/*: any*/),
    "type": {
      "kind": "NonNullType",
      "type": {
        "kind": "NamedType",
        "name": {
          "kind": "Name",
          "value": "String"
        }
      }
    }
  }
],
v8 = {
  "kind": "Name",
  "value": "user"
},
v9 = {
  "kind": "Name",
  "value": "id"
},
v10 = [
  {
    "kind": "Argument",
    "name": (v9/*: any*/),
    "value": (v1/*: any*/)
  }
],
v11 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "name"
  }
},
v12 = {
  "kind": "Name",
  "value": "compiledHooks_ChildFragment"
},
v13 = {
  "kind": "Name",
  "value": "compiledHooks_RefetchableFragment"
},
v14 = {
  "kind": "Name",
  "value": "compiledHooks_ForwardPaginationFragment"
},
v15 = {
  "kind": "Field",
  "name": (v9/*: any*/)
},
v16 = {
  "kind": "Name",
  "value": "compiledHooks_QueryTypeFragment"
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
  "kind": "Name",
  "value": "node"
},
v22 = {
  "kind": "Name",
  "value": "__typename"
},
v23 = {
  "kind": "Field",
  "name": (v22/*: any*/)
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
    "value": "User"
  }
},
v27 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "petName"
  }
},
v28 = {
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
      "value": (v4/*: any*/)
    }
  ]
},
v29 = {
  "kind": "NamedType",
  "name": {
    "kind": "Name",
    "value": "Node"
  }
},
v30 = {
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
};
return {
  "executionQueryDocument": {
    "kind": "Document",
    "definitions": [
      {
        "kind": "OperationDefinition",
        "operation": "query",
        "name": (v0/*: any*/),
        "variableDefinitions": (v7/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v8/*: any*/),
              "arguments": (v10/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v11/*: any*/),
                  {
                    "kind": "FragmentSpread",
                    "name": (v12/*: any*/)
                  },
                  {
                    "kind": "FragmentSpread",
                    "name": (v13/*: any*/)
                  },
                  {
                    "kind": "FragmentSpread",
                    "name": (v14/*: any*/)
                  },
                  (v15/*: any*/)
                ]
              }
            },
            {
              "kind": "FragmentSpread",
              "name": (v16/*: any*/)
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
                  "value": (v5/*: any*/)
                },
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "before"
                  },
                  "value": (v6/*: any*/)
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
                          "name": (v21/*: any*/),
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
                              (v15/*: any*/),
                              (v23/*: any*/)
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
            (v15/*: any*/)
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v12/*: any*/),
        "typeCondition": (v26/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v27/*: any*/),
            (v15/*: any*/)
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v14/*: any*/),
        "typeCondition": {
          "kind": "NamedType",
          "name": {
            "kind": "Name",
            "value": "NodeWithPetAvatarAndConversations"
          }
        },
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "alias": {
                "kind": "Name",
                "value": "__isNodeWithPetAvatarAndConversations"
              },
              "name": (v22/*: any*/)
            },
            (v27/*: any*/),
            (v28/*: any*/),
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "conversations"
              },
              "arguments": [
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "first"
                  },
                  "value": {
                    "kind": "IntValue",
                    "value": "1"
                  }
                },
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "after"
                  },
                  "value": {
                    "kind": "StringValue",
                    "value": "",
                    "block": false
                  }
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
                        "value": "compiledHooks_user_conversations",
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
                          "name": (v21/*: any*/),
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              {
                                "kind": "Field",
                                "name": {
                                  "kind": "Name",
                                  "value": "title"
                                }
                              },
                              {
                                "kind": "FragmentSpread",
                                "name": (v17/*: any*/)
                              },
                              (v15/*: any*/),
                              (v23/*: any*/)
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
                  }
                ]
              }
            },
            {
              "kind": "InlineFragment",
              "typeCondition": (v29/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "alias": {
                      "kind": "Name",
                      "value": "__isNode"
                    },
                    "name": (v22/*: any*/)
                  },
                  (v15/*: any*/)
                ]
              }
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v16/*: any*/),
        "typeCondition": {
          "kind": "NamedType",
          "name": {
            "kind": "Name",
            "value": "Query"
          }
        },
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "nonNode"
              },
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v15/*: any*/)
                ]
              }
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v13/*: any*/),
        "typeCondition": (v26/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v27/*: any*/),
            (v28/*: any*/),
            (v15/*: any*/)
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
        "variableDefinitions": (v7/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v8/*: any*/),
              "arguments": (v10/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v11/*: any*/),
                  (v15/*: any*/),
                  {
                    "kind": "InlineFragment",
                    "typeCondition": (v29/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        (v30/*: any*/)
                      ]
                    }
                  }
                ]
              }
            },
            (v30/*: any*/)
          ]
        }
      }
    ]
  }
};
})();

export default documents;