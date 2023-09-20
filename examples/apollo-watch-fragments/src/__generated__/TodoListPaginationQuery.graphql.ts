/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type TodoListPaginationQueryVariables = {
    after: string;
    count: number;
    includeSomeOtherField?: boolean | null | undefined;
    id: string;
};
export type TodoListPaginationQueryResponse = {
    readonly node: {
        readonly " $fragmentRefs": FragmentRefs<"TodoList_nodeFragment">;
    } | null;
};
export type TodoListPaginationQuery = {
    readonly response: TodoListPaginationQueryResponse;
    readonly variables: TodoListPaginationQueryVariables;
};


/*
query TodoListPaginationQuery($after: String! = "", $count: Int! = 5, $includeSomeOtherField: Boolean, $id: ID!) {
  node(id: $id) {
    __typename
    ...TodoList_nodeFragment_2QE1um
    id
  }
}

fragment TodoList_nodeFragment_2QE1um on NodeWithTodos {
  __typename
  todos(first: $count, after: $after) @connection(key: "TodosList_todos") {
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
query TodoListPaginationQuery($after: String! = "", $count: Int! = 5, $includeSomeOtherField: Boolean, $id: ID!) {
  node(id: $id) {
    __typename
    ...TodoList_nodeFragment_2QE1um
    id
    ... on Node {
      __fragments @client
    }
  }
}

fragment TodoList_nodeFragment_2QE1um on NodeWithTodos {
  __typename
  todos(first: $count, after: $after) @connection(key: "TodosList_todos") {
    edges {
      node {
        id
        isCompleted
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
    id
  }
  id
}
*/

export const documents: import("@graphitation/apollo-react-relay-duct-tape-compiler").CompiledArtefactModule = (function(){
var v0 = {
  "kind": "Name",
  "value": "TodoListPaginationQuery"
},
v1 = {
  "kind": "Name",
  "value": "after"
},
v2 = {
  "kind": "Variable",
  "name": (v1/*: any*/)
},
v3 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "count"
  }
},
v4 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "includeSomeOtherField"
  }
},
v5 = {
  "kind": "Name",
  "value": "id"
},
v6 = {
  "kind": "Variable",
  "name": (v5/*: any*/)
},
v7 = [
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
    },
    "defaultValue": {
      "kind": "StringValue",
      "value": "",
      "block": false
    }
  },
  {
    "kind": "VariableDefinition",
    "variable": (v3/*: any*/),
    "type": {
      "kind": "NonNullType",
      "type": {
        "kind": "NamedType",
        "name": {
          "kind": "Name",
          "value": "Int"
        }
      }
    },
    "defaultValue": {
      "kind": "IntValue",
      "value": "5"
    }
  },
  {
    "kind": "VariableDefinition",
    "variable": (v4/*: any*/),
    "type": {
      "kind": "NamedType",
      "name": {
        "kind": "Name",
        "value": "Boolean"
      }
    }
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
          "value": "ID"
        }
      }
    }
  }
],
v8 = {
  "kind": "Name",
  "value": "node"
},
v9 = [
  {
    "kind": "Argument",
    "name": (v5/*: any*/),
    "value": (v6/*: any*/)
  }
],
v10 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "__typename"
  }
},
v11 = {
  "kind": "Name",
  "value": "TodoList_nodeFragment_2QE1um"
},
v12 = {
  "kind": "FragmentSpread",
  "name": (v11/*: any*/)
},
v13 = {
  "kind": "Field",
  "name": (v5/*: any*/)
},
v14 = {
  "kind": "NamedType",
  "name": {
    "kind": "Name",
    "value": "NodeWithTodos"
  }
},
v15 = {
  "kind": "Name",
  "value": "todos"
},
v16 = [
  {
    "kind": "Argument",
    "name": {
      "kind": "Name",
      "value": "first"
    },
    "value": (v3/*: any*/)
  },
  {
    "kind": "Argument",
    "name": (v1/*: any*/),
    "value": (v2/*: any*/)
  }
],
v17 = [
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
      }
    ]
  }
],
v18 = {
  "kind": "Name",
  "value": "edges"
},
v19 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "isCompleted"
  }
},
v20 = {
  "kind": "Name",
  "value": "Todo_todoFragment"
},
v21 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "cursor"
  }
},
v22 = {
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
v23 = {
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
        "variableDefinitions": (v7/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v8/*: any*/),
              "arguments": (v9/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v10/*: any*/),
                  (v12/*: any*/),
                  (v13/*: any*/)
                ]
              }
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v11/*: any*/),
        "typeCondition": (v14/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v10/*: any*/),
            {
              "kind": "Field",
              "name": (v15/*: any*/),
              "arguments": (v16/*: any*/),
              "directives": (v17/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": (v18/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": (v8/*: any*/),
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              (v13/*: any*/),
                              (v19/*: any*/),
                              {
                                "kind": "FragmentSpread",
                                "name": (v20/*: any*/)
                              },
                              (v10/*: any*/)
                            ]
                          }
                        },
                        (v21/*: any*/)
                      ]
                    }
                  },
                  (v22/*: any*/),
                  (v13/*: any*/)
                ]
              }
            },
            (v13/*: any*/)
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
            "value": "Todo"
          }
        },
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v13/*: any*/),
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "description"
              }
            },
            (v19/*: any*/),
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
                      "value": (v4/*: any*/)
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
        "variableDefinitions": (v7/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v8/*: any*/),
              "arguments": (v9/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v10/*: any*/),
                  (v12/*: any*/),
                  (v13/*: any*/),
                  (v23/*: any*/)
                ]
              }
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v11/*: any*/),
        "typeCondition": (v14/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v10/*: any*/),
            {
              "kind": "Field",
              "name": (v15/*: any*/),
              "arguments": (v16/*: any*/),
              "directives": (v17/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": (v18/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": (v8/*: any*/),
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              (v13/*: any*/),
                              (v19/*: any*/),
                              (v10/*: any*/),
                              (v23/*: any*/)
                            ]
                          }
                        },
                        (v21/*: any*/)
                      ]
                    }
                  },
                  (v22/*: any*/),
                  (v13/*: any*/)
                ]
              }
            },
            (v13/*: any*/)
          ]
        }
      }
    ]
  },
  "metadata": {
    "rootSelection": "node",
    "mainFragment": {
      "name": "TodoList_nodeFragment_2QE1um",
      "typeCondition": "NodeWithTodos"
    },
    "connection": {
      "selectionPath": [
        "todos"
      ],
      "forwardCountVariable": "count",
      "forwardCursorVariable": "after"
    }
  }
};
})();

export default documents;