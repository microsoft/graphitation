/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type AppQueryVariables = {
    includeSomeOtherField: boolean;
};
export type AppQueryResponse = {
    readonly me: {
        readonly todoStats: {
            readonly id: string;
            readonly totalCount: number;
            readonly " $fragmentRefs": FragmentRefs<"TodoListFooter_todosFragment">;
        };
        readonly " $fragmentRefs": FragmentRefs<"TodoList_nodeFragment">;
    };
};
export type AppQuery = {
    readonly response: AppQueryResponse;
    readonly variables: AppQueryVariables;
};


/*
query AppQuery($includeSomeOtherField: Boolean!) {
  me {
    todoStats: todos(first: 0) {
      id
      totalCount
      ...TodoListFooter_todosFragment
    }
    ...TodoList_nodeFragment
    id
  }
}

fragment TodoListFooter_todosFragment on TodosConnection {
  uncompletedCount
  id
}

fragment TodoList_nodeFragment on NodeWithTodos {
  __isNodeWithTodos: __typename
  __typename
  todos(first: 5, after: "") @connection(key: "TodosList_todos", filter: ["sortByOrder"]) {
    edges {
      node {
        id
        isCompleted
        ...Todo_todoFragment
        __typename
      }
      cursor
    }
    pageInfo {
      endCursor
      hasNextPage
    }
    id
  }
  id
}

fragment Todo_todoFragment on Todo {
  id
  description
  isCompleted
  someOtherField @include(if: $includeSomeOtherField)
}
*/

/*
query AppQuery($includeSomeOtherField: Boolean!) {
  me {
    todoStats: todos(first: 0) {
      id
      totalCount
      ... on Node {
        __fragments @client
      }
    }
    id
    ... on Node {
      __fragments @client
    }
  }
}
*/

export const documents: import("@graphitation/apollo-react-relay-duct-tape-compiler").CompiledArtefactModule = (function(){
var v0 = {
  "kind": "Name",
  "value": "AppQuery"
},
v1 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "includeSomeOtherField"
  }
},
v2 = [
  {
    "kind": "VariableDefinition",
    "variable": (v1/*: any*/),
    "type": {
      "kind": "NonNullType",
      "type": {
        "kind": "NamedType",
        "name": {
          "kind": "Name",
          "value": "Boolean"
        }
      }
    }
  }
],
v3 = {
  "kind": "Name",
  "value": "me"
},
v4 = {
  "kind": "Name",
  "value": "todoStats"
},
v5 = {
  "kind": "Name",
  "value": "todos"
},
v6 = {
  "kind": "Name",
  "value": "first"
},
v7 = [
  {
    "kind": "Argument",
    "name": (v6/*: any*/),
    "value": {
      "kind": "IntValue",
      "value": "0"
    }
  }
],
v8 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "id"
  }
},
v9 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "totalCount"
  }
},
v10 = {
  "kind": "Name",
  "value": "TodoListFooter_todosFragment"
},
v11 = {
  "kind": "Name",
  "value": "TodoList_nodeFragment"
},
v12 = {
  "kind": "Name",
  "value": "__typename"
},
v13 = {
  "kind": "Field",
  "name": (v12/*: any*/)
},
v14 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "isCompleted"
  }
},
v15 = {
  "kind": "Name",
  "value": "Todo_todoFragment"
},
v16 = {
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
        "variableDefinitions": (v2/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v3/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "alias": (v4/*: any*/),
                    "name": (v5/*: any*/),
                    "arguments": (v7/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        (v8/*: any*/),
                        (v9/*: any*/),
                        {
                          "kind": "FragmentSpread",
                          "name": (v10/*: any*/)
                        }
                      ]
                    }
                  },
                  {
                    "kind": "FragmentSpread",
                    "name": (v11/*: any*/)
                  },
                  (v8/*: any*/)
                ]
              }
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v10/*: any*/),
        "typeCondition": {
          "kind": "NamedType",
          "name": {
            "kind": "Name",
            "value": "TodosConnection"
          }
        },
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "uncompletedCount"
              }
            },
            (v8/*: any*/)
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v11/*: any*/),
        "typeCondition": {
          "kind": "NamedType",
          "name": {
            "kind": "Name",
            "value": "NodeWithTodos"
          }
        },
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "alias": {
                "kind": "Name",
                "value": "__isNodeWithTodos"
              },
              "name": (v12/*: any*/)
            },
            (v13/*: any*/),
            {
              "kind": "Field",
              "name": (v5/*: any*/),
              "arguments": [
                {
                  "kind": "Argument",
                  "name": (v6/*: any*/),
                  "value": {
                    "kind": "IntValue",
                    "value": "5"
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
                        "value": "TodosList_todos",
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
                            "value": "sortByOrder",
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
                    "name": {
                      "kind": "Name",
                      "value": "edges"
                    },
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "node"
                          },
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              (v8/*: any*/),
                              (v14/*: any*/),
                              {
                                "kind": "FragmentSpread",
                                "name": (v15/*: any*/)
                              },
                              (v13/*: any*/)
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
                  (v8/*: any*/)
                ]
              }
            },
            (v8/*: any*/)
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v15/*: any*/),
        "typeCondition": {
          "kind": "NamedType",
          "name": {
            "kind": "Name",
            "value": "Todo"
          }
        },
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v8/*: any*/),
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "description"
              }
            },
            (v14/*: any*/),
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "someOtherField"
              },
              "directives": [
                {
                  "kind": "Directive",
                  "name": {
                    "kind": "Name",
                    "value": "include"
                  },
                  "arguments": [
                    {
                      "kind": "Argument",
                      "name": {
                        "kind": "Name",
                        "value": "if"
                      },
                      "value": (v1/*: any*/)
                    }
                  ]
                }
              ]
            }
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
        "variableDefinitions": (v2/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v3/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "alias": (v4/*: any*/),
                    "name": (v5/*: any*/),
                    "arguments": (v7/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        (v8/*: any*/),
                        (v9/*: any*/),
                        (v16/*: any*/)
                      ]
                    }
                  },
                  (v8/*: any*/),
                  (v16/*: any*/)
                ]
              }
            }
          ]
        }
      }
    ]
  }
};
})();

export default documents;