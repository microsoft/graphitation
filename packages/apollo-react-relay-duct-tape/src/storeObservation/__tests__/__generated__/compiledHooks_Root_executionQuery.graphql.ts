/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type SortDirection = "ASC" | "DESC";
export type SortField = "CREATED_AT" | "NAME";
export type FilterByInput = {
    tag?: string | null | undefined;
    keyword?: string | null | undefined;
};
export type SortByInput = {
    sortDirection: SortDirection;
    sortField: SortField;
};
export type compiledHooks_Root_executionQueryVariables = {
    userId: number;
    messagesBackwardCount: number;
    messagesBeforeCursor: string;
    id?: string | null | undefined;
    filterBy?: FilterByInput | null | undefined;
    sortBy?: SortByInput | null | undefined;
    avatarSize?: number | null | undefined;
};
export type compiledHooks_Root_executionQueryResponse = {
    readonly user: {
        readonly name: string;
        readonly " $fragmentSpreads": FragmentRefs<"compiledHooks_ChildFragment" | "compiledHooks_RefetchableFragment" | "compiledHooks_ForwardPaginationFragment">;
    };
    readonly " $fragmentSpreads": FragmentRefs<"compiledHooks_QueryTypeFragment">;
};
export type compiledHooks_Root_executionQuery = {
    readonly response: compiledHooks_Root_executionQueryResponse;
    readonly variables: compiledHooks_Root_executionQueryVariables;
};


/*
query compiledHooks_Root_executionQuery($userId: Int!, $messagesBackwardCount: Int!, $messagesBeforeCursor: String!, $id: String = "shouldNotOverrideCompiledFragmentId", $filterBy: FilterByInput = {tag: "ALL"}, $sortBy: SortByInput, $avatarSize: Int = 21) {
  user(id: $userId, idThatDoesntOverride: $id, filterBy: $filterBy) {
    name
    ...compiledHooks_ChildFragment
    ...compiledHooks_RefetchableFragment_17xSkz
    ...compiledHooks_ForwardPaginationFragment_17xSkz
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

fragment compiledHooks_ForwardPaginationFragment_17xSkz on NodeWithPetAvatarAndConversations {
  __isNodeWithPetAvatarAndConversations: __typename
  petName
  avatarUrl(size: $avatarSize)
  conversations(first: 1, after: "", sortBy: $sortBy) @connection(key: "compiledHooks_user_conversations", filter: ["sortBy"]) {
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

fragment compiledHooks_RefetchableFragment_17xSkz on User {
  petName
  avatarUrl(size: $avatarSize)
  id
}
*/

/*
query compiledHooks_Root_executionQuery($userId: Int!, $messagesBackwardCount: Int!, $messagesBeforeCursor: String!, $id: String = "shouldNotOverrideCompiledFragmentId", $filterBy: FilterByInput = {tag: "ALL"}, $sortBy: SortByInput, $avatarSize: Int = 21) {
  user(id: $userId, idThatDoesntOverride: $id, filterBy: $filterBy) {
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
    "value": "messagesBackwardCount"
  }
},
v5 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "messagesBeforeCursor"
  }
},
v6 = {
  "kind": "NamedType",
  "name": {
    "kind": "Name",
    "value": "String"
  }
},
v7 = {
  "kind": "Name",
  "value": "id"
},
v8 = {
  "kind": "Variable",
  "name": (v7/*: any*/)
},
v9 = {
  "kind": "Name",
  "value": "filterBy"
},
v10 = {
  "kind": "Variable",
  "name": (v9/*: any*/)
},
v11 = {
  "kind": "Name",
  "value": "sortBy"
},
v12 = {
  "kind": "Variable",
  "name": (v11/*: any*/)
},
v13 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "avatarSize"
  }
},
v14 = [
  {
    "kind": "VariableDefinition",
    "variable": (v1/*: any*/),
    "type": (v3/*: any*/)
  },
  {
    "kind": "VariableDefinition",
    "variable": (v4/*: any*/),
    "type": (v3/*: any*/)
  },
  {
    "kind": "VariableDefinition",
    "variable": (v5/*: any*/),
    "type": {
      "kind": "NonNullType",
      "type": (v6/*: any*/)
    }
  },
  {
    "kind": "VariableDefinition",
    "variable": (v8/*: any*/),
    "type": (v6/*: any*/),
    "defaultValue": {
      "kind": "StringValue",
      "value": "shouldNotOverrideCompiledFragmentId",
      "block": false
    }
  },
  {
    "kind": "VariableDefinition",
    "variable": (v10/*: any*/),
    "type": {
      "kind": "NamedType",
      "name": {
        "kind": "Name",
        "value": "FilterByInput"
      }
    },
    "defaultValue": {
      "kind": "ObjectValue",
      "fields": [
        {
          "kind": "ObjectField",
          "name": {
            "kind": "Name",
            "value": "tag"
          },
          "value": {
            "kind": "StringValue",
            "value": "ALL",
            "block": false
          }
        }
      ]
    }
  },
  {
    "kind": "VariableDefinition",
    "variable": (v12/*: any*/),
    "type": {
      "kind": "NamedType",
      "name": {
        "kind": "Name",
        "value": "SortByInput"
      }
    }
  },
  {
    "kind": "VariableDefinition",
    "variable": (v13/*: any*/),
    "type": (v2/*: any*/),
    "defaultValue": {
      "kind": "IntValue",
      "value": "21"
    }
  }
],
v15 = {
  "kind": "Name",
  "value": "user"
},
v16 = [
  {
    "kind": "Argument",
    "name": (v7/*: any*/),
    "value": (v1/*: any*/)
  },
  {
    "kind": "Argument",
    "name": {
      "kind": "Name",
      "value": "idThatDoesntOverride"
    },
    "value": (v8/*: any*/)
  },
  {
    "kind": "Argument",
    "name": (v9/*: any*/),
    "value": (v10/*: any*/)
  }
],
v17 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "name"
  }
},
v18 = {
  "kind": "Name",
  "value": "compiledHooks_ChildFragment"
},
v19 = {
  "kind": "Name",
  "value": "compiledHooks_RefetchableFragment_17xSkz"
},
v20 = {
  "kind": "Name",
  "value": "compiledHooks_ForwardPaginationFragment_17xSkz"
},
v21 = {
  "kind": "Field",
  "name": (v7/*: any*/)
},
v22 = {
  "kind": "Name",
  "value": "compiledHooks_QueryTypeFragment"
},
v23 = {
  "kind": "Name",
  "value": "compiledHooks_BackwardPaginationFragment"
},
v24 = {
  "kind": "Name",
  "value": "connection"
},
v25 = {
  "kind": "Name",
  "value": "key"
},
v26 = {
  "kind": "Name",
  "value": "edges"
},
v27 = {
  "kind": "Name",
  "value": "node"
},
v28 = {
  "kind": "Name",
  "value": "__typename"
},
v29 = {
  "kind": "Field",
  "name": (v28/*: any*/)
},
v30 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "cursor"
  }
},
v31 = {
  "kind": "Name",
  "value": "pageInfo"
},
v32 = {
  "kind": "NamedType",
  "name": {
    "kind": "Name",
    "value": "User"
  }
},
v33 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "petName"
  }
},
v34 = {
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
      "value": (v13/*: any*/)
    }
  ]
},
v35 = {
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
        "variableDefinitions": (v14/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v15/*: any*/),
              "arguments": (v16/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v17/*: any*/),
                  {
                    "kind": "FragmentSpread",
                    "name": (v18/*: any*/)
                  },
                  {
                    "kind": "FragmentSpread",
                    "name": (v19/*: any*/)
                  },
                  {
                    "kind": "FragmentSpread",
                    "name": (v20/*: any*/)
                  },
                  (v21/*: any*/)
                ]
              }
            },
            {
              "kind": "FragmentSpread",
              "name": (v22/*: any*/)
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v23/*: any*/),
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
                  "value": (v4/*: any*/)
                },
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "before"
                  },
                  "value": (v5/*: any*/)
                }
              ],
              "directives": [
                {
                  "kind": "Directive",
                  "name": (v24/*: any*/),
                  "arguments": [
                    {
                      "kind": "Argument",
                      "name": (v25/*: any*/),
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
                    "name": (v26/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": (v27/*: any*/),
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
                              (v21/*: any*/),
                              (v29/*: any*/)
                            ]
                          }
                        },
                        (v30/*: any*/)
                      ]
                    }
                  },
                  {
                    "kind": "Field",
                    "name": (v31/*: any*/),
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
            (v21/*: any*/)
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v18/*: any*/),
        "typeCondition": (v32/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v33/*: any*/),
            (v21/*: any*/)
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
              "name": (v28/*: any*/)
            },
            (v33/*: any*/),
            (v34/*: any*/),
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
                },
                {
                  "kind": "Argument",
                  "name": (v11/*: any*/),
                  "value": (v12/*: any*/)
                }
              ],
              "directives": [
                {
                  "kind": "Directive",
                  "name": (v24/*: any*/),
                  "arguments": [
                    {
                      "kind": "Argument",
                      "name": (v25/*: any*/),
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
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": (v26/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": (v27/*: any*/),
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
                                "name": (v23/*: any*/)
                              },
                              (v21/*: any*/),
                              (v29/*: any*/)
                            ]
                          }
                        },
                        (v30/*: any*/)
                      ]
                    }
                  },
                  {
                    "kind": "Field",
                    "name": (v31/*: any*/),
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
            (v21/*: any*/)
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v22/*: any*/),
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
                  (v21/*: any*/)
                ]
              }
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v19/*: any*/),
        "typeCondition": (v32/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v33/*: any*/),
            (v34/*: any*/),
            (v21/*: any*/)
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
        "variableDefinitions": (v14/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v15/*: any*/),
              "arguments": (v16/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v17/*: any*/),
                  (v21/*: any*/),
                  {
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
                        (v35/*: any*/)
                      ]
                    }
                  }
                ]
              }
            },
            (v35/*: any*/)
          ]
        }
      }
    ]
  }
};
})();

export default documents;