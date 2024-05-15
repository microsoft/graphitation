/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type FilterByInput = {
    tag?: string | null | undefined;
    keyword?: string | null | undefined;
};
export type compiledHooks_Root_executionQueryVariables = {
    userId: number;
    avatarSize?: number | null | undefined;
    messagesBackwardCount: number;
    messagesBeforeCursor: string;
    id?: string | null | undefined;
    filterBy?: FilterByInput | null | undefined;
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
query compiledHooks_Root_executionQuery($userId: Int!, $avatarSize: Int = 21, $messagesBackwardCount: Int!, $messagesBeforeCursor: String!, $id: String = "shouldNotOverrideCompiledFragmentId", $filterBy: FilterByInput = {tag: "ALL"}) {
  user(id: $userId, idThatDoesntOverride: $id, filterBy: $filterBy) {
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
  conversations(
    first: 1
    after: ""
    sortBy: {sortField: NAME, sortDirection: ASC}
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
query compiledHooks_Root_executionQuery($userId: Int!, $avatarSize: Int = 21, $messagesBackwardCount: Int!, $messagesBeforeCursor: String!, $id: String = "shouldNotOverrideCompiledFragmentId", $filterBy: FilterByInput = {tag: "ALL"}) {
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
v7 = {
  "kind": "NamedType",
  "name": {
    "kind": "Name",
    "value": "String"
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
v10 = {
  "kind": "Name",
  "value": "filterBy"
},
v11 = {
  "kind": "Variable",
  "name": (v10/*: any*/)
},
v12 = [
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
      "type": (v7/*: any*/)
    }
  },
  {
    "kind": "VariableDefinition",
    "variable": (v9/*: any*/),
    "type": (v7/*: any*/),
    "defaultValue": {
      "kind": "StringValue",
      "value": "shouldNotOverrideCompiledFragmentId",
      "block": false
    }
  },
  {
    "kind": "VariableDefinition",
    "variable": (v11/*: any*/),
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
  }
],
v13 = {
  "kind": "Name",
  "value": "user"
},
v14 = [
  {
    "kind": "Argument",
    "name": (v8/*: any*/),
    "value": (v1/*: any*/)
  },
  {
    "kind": "Argument",
    "name": {
      "kind": "Name",
      "value": "idThatDoesntOverride"
    },
    "value": (v9/*: any*/)
  },
  {
    "kind": "Argument",
    "name": (v10/*: any*/),
    "value": (v11/*: any*/)
  }
],
v15 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "name"
  }
},
v16 = {
  "kind": "Name",
  "value": "compiledHooks_ChildFragment"
},
v17 = {
  "kind": "Name",
  "value": "compiledHooks_RefetchableFragment"
},
v18 = {
  "kind": "Name",
  "value": "compiledHooks_ForwardPaginationFragment"
},
v19 = {
  "kind": "Field",
  "name": (v8/*: any*/)
},
v20 = {
  "kind": "Name",
  "value": "compiledHooks_QueryTypeFragment"
},
v21 = {
  "kind": "Name",
  "value": "compiledHooks_BackwardPaginationFragment"
},
v22 = {
  "kind": "Name",
  "value": "connection"
},
v23 = {
  "kind": "Name",
  "value": "key"
},
v24 = {
  "kind": "Name",
  "value": "edges"
},
v25 = {
  "kind": "Name",
  "value": "node"
},
v26 = {
  "kind": "Name",
  "value": "__typename"
},
v27 = {
  "kind": "Field",
  "name": (v26/*: any*/)
},
v28 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "cursor"
  }
},
v29 = {
  "kind": "Name",
  "value": "pageInfo"
},
v30 = {
  "kind": "NamedType",
  "name": {
    "kind": "Name",
    "value": "User"
  }
},
v31 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "petName"
  }
},
v32 = {
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
v33 = {
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
                  (v15/*: any*/),
                  {
                    "kind": "FragmentSpread",
                    "name": (v16/*: any*/)
                  },
                  {
                    "kind": "FragmentSpread",
                    "name": (v17/*: any*/)
                  },
                  {
                    "kind": "FragmentSpread",
                    "name": (v18/*: any*/)
                  },
                  (v19/*: any*/)
                ]
              }
            },
            {
              "kind": "FragmentSpread",
              "name": (v20/*: any*/)
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v21/*: any*/),
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
                  "name": (v22/*: any*/),
                  "arguments": [
                    {
                      "kind": "Argument",
                      "name": (v23/*: any*/),
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
                    "name": (v24/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
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
                                  "value": "text"
                                }
                              },
                              (v19/*: any*/),
                              (v27/*: any*/)
                            ]
                          }
                        },
                        (v28/*: any*/)
                      ]
                    }
                  },
                  {
                    "kind": "Field",
                    "name": (v29/*: any*/),
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
        "name": (v16/*: any*/),
        "typeCondition": (v30/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v31/*: any*/),
            (v19/*: any*/)
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v18/*: any*/),
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
              "name": (v26/*: any*/)
            },
            (v31/*: any*/),
            (v32/*: any*/),
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
                  "name": {
                    "kind": "Name",
                    "value": "sortBy"
                  },
                  "value": {
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
                }
              ],
              "directives": [
                {
                  "kind": "Directive",
                  "name": (v22/*: any*/),
                  "arguments": [
                    {
                      "kind": "Argument",
                      "name": (v23/*: any*/),
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
                    "name": (v24/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
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
                                  "value": "title"
                                }
                              },
                              {
                                "kind": "FragmentSpread",
                                "name": (v21/*: any*/)
                              },
                              (v19/*: any*/),
                              (v27/*: any*/)
                            ]
                          }
                        },
                        (v28/*: any*/)
                      ]
                    }
                  },
                  {
                    "kind": "Field",
                    "name": (v29/*: any*/),
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
            (v19/*: any*/)
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
                  (v19/*: any*/)
                ]
              }
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v17/*: any*/),
        "typeCondition": (v30/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v31/*: any*/),
            (v32/*: any*/),
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
                  (v15/*: any*/),
                  (v19/*: any*/),
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
                        (v33/*: any*/)
                      ]
                    }
                  }
                ]
              }
            },
            (v33/*: any*/)
          ]
        }
      }
    ]
  }
};
})();

export default documents;