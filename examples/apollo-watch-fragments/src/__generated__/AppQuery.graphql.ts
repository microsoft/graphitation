/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type AppQueryVariables = {
    after?: string | null | undefined;
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
query AppQuery($after: String) {
  me {
    todoStats: todos(first: 0, after: $after) {
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
  id
  todos(first: 5, after: "") {
    edges {
      node {
        id
        isCompleted
        ...Todo_todoFragment
      }
    }
    id
  }
}

fragment Todo_todoFragment on Todo {
  id
  description
  isCompleted
  someOtherField
}
*/

/*
query AppQuery($after: String) {
  me {
    todoStats: todos(first: 0, after: $after) {
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
  "kind": "Name",
  "value": "after"
},
v2 = {
  "kind": "Variable",
  "name": (v1/*: any*/)
},
v3 = [
  {
    "kind": "VariableDefinition",
    "variable": (v2/*: any*/),
    "type": {
      "kind": "NamedType",
      "name": {
        "kind": "Name",
        "value": "String"
      }
    }
  }
],
v4 = {
  "kind": "Name",
  "value": "me"
},
v5 = {
  "kind": "Name",
  "value": "todoStats"
},
v6 = {
  "kind": "Name",
  "value": "todos"
},
v7 = {
  "kind": "Name",
  "value": "first"
},
v8 = [
  {
    "kind": "Argument",
    "name": (v7/*: any*/),
    "value": {
      "kind": "IntValue",
      "value": "0"
    }
  },
  {
    "kind": "Argument",
    "name": (v1/*: any*/),
    "value": (v2/*: any*/)
  }
],
v9 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "id"
  }
},
v10 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "totalCount"
  }
},
v11 = {
  "kind": "Name",
  "value": "TodoListFooter_todosFragment"
},
v12 = {
  "kind": "Name",
  "value": "TodoList_nodeFragment"
},
v13 = {
  "kind": "Name",
  "value": "__typename"
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
        "variableDefinitions": (v3/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v4/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "alias": (v5/*: any*/),
                    "name": (v6/*: any*/),
                    "arguments": (v8/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        (v9/*: any*/),
                        (v10/*: any*/),
                        {
                          "kind": "FragmentSpread",
                          "name": (v11/*: any*/)
                        }
                      ]
                    }
                  },
                  {
                    "kind": "FragmentSpread",
                    "name": (v12/*: any*/)
                  },
                  (v9/*: any*/)
                ]
              }
            }
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
            (v9/*: any*/)
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v12/*: any*/),
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
              "name": (v13/*: any*/)
            },
            {
              "kind": "Field",
              "name": (v13/*: any*/)
            },
            (v9/*: any*/),
            {
              "kind": "Field",
              "name": (v6/*: any*/),
              "arguments": [
                {
                  "kind": "Argument",
                  "name": (v7/*: any*/),
                  "value": {
                    "kind": "IntValue",
                    "value": "5"
                  }
                },
                {
                  "kind": "Argument",
                  "name": (v1/*: any*/),
                  "value": {
                    "kind": "StringValue",
                    "value": "",
                    "block": false
                  }
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
                              (v9/*: any*/),
                              (v14/*: any*/),
                              {
                                "kind": "FragmentSpread",
                                "name": (v15/*: any*/)
                              }
                            ]
                          }
                        }
                      ]
                    }
                  },
                  (v9/*: any*/)
                ]
              }
            }
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
            (v9/*: any*/),
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
              }
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
        "variableDefinitions": (v3/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v4/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "alias": (v5/*: any*/),
                    "name": (v6/*: any*/),
                    "arguments": (v8/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        (v9/*: any*/),
                        (v10/*: any*/),
                        (v16/*: any*/)
                      ]
                    }
                  },
                  (v9/*: any*/),
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