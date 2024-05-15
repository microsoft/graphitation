/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type compiledHooks_BackwardPaginationFragment_PaginationQueryVariables = {
    messagesBackwardCount: number;
    messagesBeforeCursor: string;
    id: string;
};
export type compiledHooks_BackwardPaginationFragment_PaginationQueryResponse = {
    readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"compiledHooks_BackwardPaginationFragment">;
    } | null;
};
export type compiledHooks_BackwardPaginationFragment_PaginationQuery = {
    readonly response: compiledHooks_BackwardPaginationFragment_PaginationQueryResponse;
    readonly variables: compiledHooks_BackwardPaginationFragment_PaginationQueryVariables;
};


/*
query compiledHooks_BackwardPaginationFragment_PaginationQuery($messagesBackwardCount: Int!, $messagesBeforeCursor: String!, $id: ID!) {
  node(id: $id) {
    __typename
    ...compiledHooks_BackwardPaginationFragment
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
*/

/*
query compiledHooks_BackwardPaginationFragment_PaginationQuery($messagesBackwardCount: Int!, $messagesBeforeCursor: String!, $id: ID!) {
  node(id: $id) {
    __typename
    ...compiledHooks_BackwardPaginationFragment
    id
    ... on Node {
      __fragments @client
    }
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
*/

export const documents: import("@graphitation/apollo-react-relay-duct-tape-compiler").CompiledArtefactModule = (function(){
var v0 = {
  "kind": "Name",
  "value": "compiledHooks_BackwardPaginationFragment_PaginationQuery"
},
v1 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "messagesBackwardCount"
  }
},
v2 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "messagesBeforeCursor"
  }
},
v3 = {
  "kind": "Name",
  "value": "id"
},
v4 = {
  "kind": "Variable",
  "name": (v3/*: any*/)
},
v5 = [
  {
    "kind": "VariableDefinition",
    "variable": (v1/*: any*/),
    "type": {
      "kind": "NonNullType",
      "type": {
        "kind": "NamedType",
        "name": {
          "kind": "Name",
          "value": "Int"
        }
      }
    }
  },
  {
    "kind": "VariableDefinition",
    "variable": (v2/*: any*/),
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
  },
  {
    "kind": "VariableDefinition",
    "variable": (v4/*: any*/),
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
v6 = {
  "kind": "Name",
  "value": "node"
},
v7 = [
  {
    "kind": "Argument",
    "name": (v3/*: any*/),
    "value": (v4/*: any*/)
  }
],
v8 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "__typename"
  }
},
v9 = {
  "kind": "Name",
  "value": "compiledHooks_BackwardPaginationFragment"
},
v10 = {
  "kind": "FragmentSpread",
  "name": (v9/*: any*/)
},
v11 = {
  "kind": "Field",
  "name": (v3/*: any*/)
},
v12 = {
  "kind": "FragmentDefinition",
  "name": (v9/*: any*/),
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
            "value": (v1/*: any*/)
          },
          {
            "kind": "Argument",
            "name": {
              "kind": "Name",
              "value": "before"
            },
            "value": (v2/*: any*/)
          }
        ],
        "directives": [
          {
            "kind": "Directive",
            "name": {
              "kind": "Name",
              "value": "connection"
            },
            "arguments": [
              {
                "kind": "Argument",
                "name": {
                  "kind": "Name",
                  "value": "key"
                },
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
              "name": {
                "kind": "Name",
                "value": "edges"
              },
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": (v6/*: any*/),
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
                        (v11/*: any*/),
                        (v8/*: any*/)
                      ]
                    }
                  },
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "cursor"
                    }
                  }
                ]
              }
            },
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "pageInfo"
              },
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
      (v11/*: any*/)
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
        "variableDefinitions": (v5/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v6/*: any*/),
              "arguments": (v7/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v8/*: any*/),
                  (v10/*: any*/),
                  (v11/*: any*/)
                ]
              }
            }
          ]
        }
      },
      (v12/*: any*/)
    ]
  },
  "watchQueryDocument": {
    "kind": "Document",
    "definitions": [
      {
        "kind": "OperationDefinition",
        "operation": "query",
        "name": (v0/*: any*/),
        "variableDefinitions": (v5/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v6/*: any*/),
              "arguments": (v7/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v8/*: any*/),
                  (v10/*: any*/),
                  (v11/*: any*/),
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
                  }
                ]
              }
            }
          ]
        }
      },
      (v12/*: any*/)
    ]
  },
  "metadata": {
    "rootSelection": "node",
    "mainFragment": {
      "name": "compiledHooks_BackwardPaginationFragment",
      "typeCondition": "Conversation"
    },
    "connection": {
      "selectionPath": [
        "messages"
      ],
      "backwardCountVariable": "messagesBackwardCount",
      "backwardCursorVariable": "messagesBeforeCursor"
    }
  }
};
})();

export default documents;