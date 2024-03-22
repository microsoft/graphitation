/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type TodoListPaginationQueryVariables = {
    after: string;
    count: number;
    includeSomeOtherField?: boolean | null | undefined;
    sortByOrder?: string | null | undefined;
    id: string;
};
export type TodoListPaginationQueryResponse = {
    readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"TodoList_nodeFragment">;
    } | null;
};
export type TodoListPaginationQuery = {
    readonly response: TodoListPaginationQueryResponse;
    readonly variables: TodoListPaginationQueryVariables;
};


/*
query TodoListPaginationQuery($after: String! = "", $count: Int! = 5, $includeSomeOtherField: Boolean, $sortByOrder: String, $id: ID!) {
  node(id: $id) {
    __typename
    ...TodoList_nodeFragment_2azoy9
    id
  }
}

fragment TodoList_nodeFragment_2azoy9 on NodeWithTodos {
  __isNodeWithTodos: __typename
  __typename
  todos(first: $count, after: $after, sortByOrder: $sortByOrder) @connection(key: "TodosList_todos", filter: ["sortByOrder"]) {
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
query TodoListPaginationQuery($after: String! = "", $count: Int! = 5, $includeSomeOtherField: Boolean, $sortByOrder: String, $id: ID!) {
  node(id: $id) {
    __typename
    ...TodoList_nodeFragment_2azoy9
    id
    ... on Node {
      __fragments @client
    }
  }
}

fragment TodoList_nodeFragment_2azoy9 on NodeWithTodos {
  __isNodeWithTodos: __typename
  __typename
  todos(first: $count, after: $after, sortByOrder: $sortByOrder) @connection(key: "TodosList_todos", filter: ["sortByOrder"]) {
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
  "kind": "NamedType",
  "name": {
    "kind": "Name",
    "value": "String"
  }
},
v4 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "count"
  }
},
v5 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "includeSomeOtherField"
  }
},
v6 = {
  "kind": "Name",
  "value": "sortByOrder"
},
v7 = {
  "kind": "Variable",
  "name": (v6/*: any*/)
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
    "variable": (v2/*: any*/),
    "type": {
      "kind": "NonNullType",
      "type": (v3/*: any*/)
    },
    "defaultValue": {
      "kind": "StringValue",
      "value": "",
      "block": false
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
    "variable": (v5/*: any*/),
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
    "variable": (v7/*: any*/),
    "type": (v3/*: any*/)
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
  "kind": "Name",
  "value": "__typename"
},
v14 = {
  "kind": "Field",
  "name": (v13/*: any*/)
},
v15 = {
  "kind": "Name",
  "value": "TodoList_nodeFragment_2azoy9"
},
v16 = {
  "kind": "FragmentSpread",
  "name": (v15/*: any*/)
},
v17 = {
  "kind": "Field",
  "name": (v8/*: any*/)
},
v18 = {
  "kind": "NamedType",
  "name": {
    "kind": "Name",
    "value": "NodeWithTodos"
  }
},
v19 = {
  "kind": "Field",
  "alias": {
    "kind": "Name",
    "value": "__isNodeWithTodos"
  },
  "name": (v13/*: any*/)
},
v20 = {
  "kind": "Name",
  "value": "todos"
},
v21 = [
  {
    "kind": "Argument",
    "name": {
      "kind": "Name",
      "value": "first"
    },
    "value": (v4/*: any*/)
  },
  {
    "kind": "Argument",
    "name": (v1/*: any*/),
    "value": (v2/*: any*/)
  },
  {
    "kind": "Argument",
    "name": (v6/*: any*/),
    "value": (v7/*: any*/)
  }
],
v22 = [
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
v23 = {
  "kind": "Name",
  "value": "edges"
},
v24 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "isCompleted"
  }
},
v25 = {
  "kind": "Name",
  "value": "Todo_todoFragment"
},
v26 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "cursor"
  }
},
v27 = {
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
v28 = {
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
                  (v14/*: any*/),
                  (v16/*: any*/),
                  (v17/*: any*/)
                ]
              }
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v15/*: any*/),
        "typeCondition": (v18/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v19/*: any*/),
            (v14/*: any*/),
            {
              "kind": "Field",
              "name": (v20/*: any*/),
              "arguments": (v21/*: any*/),
              "directives": (v22/*: any*/),
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
                          "name": (v11/*: any*/),
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              (v17/*: any*/),
                              (v24/*: any*/),
                              {
                                "kind": "FragmentSpread",
                                "name": (v25/*: any*/)
                              },
                              (v14/*: any*/)
                            ]
                          }
                        },
                        (v26/*: any*/)
                      ]
                    }
                  },
                  (v27/*: any*/),
                  (v17/*: any*/)
                ]
              }
            },
            (v17/*: any*/)
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v25/*: any*/),
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
            (v17/*: any*/),
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "description"
              }
            },
            (v24/*: any*/),
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
                      "value": (v5/*: any*/)
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
                  (v14/*: any*/),
                  (v16/*: any*/),
                  (v17/*: any*/),
                  (v28/*: any*/)
                ]
              }
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v15/*: any*/),
        "typeCondition": (v18/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v19/*: any*/),
            (v14/*: any*/),
            {
              "kind": "Field",
              "name": (v20/*: any*/),
              "arguments": (v21/*: any*/),
              "directives": (v22/*: any*/),
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
                          "name": (v11/*: any*/),
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              (v17/*: any*/),
                              (v24/*: any*/),
                              (v14/*: any*/),
                              (v28/*: any*/)
                            ]
                          }
                        },
                        (v26/*: any*/)
                      ]
                    }
                  },
                  (v27/*: any*/),
                  (v17/*: any*/)
                ]
              }
            },
            (v17/*: any*/)
          ]
        }
      }
    ]
  },
  "metadata": {
    "rootSelection": "node",
    "mainFragment": {
      "name": "TodoList_nodeFragment_2azoy9",
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