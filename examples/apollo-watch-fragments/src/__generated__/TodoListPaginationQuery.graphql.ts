/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type SortDirection = "ASC" | "DESC";
export type SortField = "DESCRIPTION" | "IS_COMPLETED";
export type SortByInput = {
    sortDirection: SortDirection;
    sortField: SortField;
};
export type TodoListPaginationQueryVariables = {
    after: string;
    count: number;
    includeSomeOtherField?: boolean | null | undefined;
    sortBy?: SortByInput | null | undefined;
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
query TodoListPaginationQuery($after: String! = "", $count: Int! = 5, $includeSomeOtherField: Boolean, $sortBy: SortByInput, $id: ID!) {
  node(id: $id) {
    __typename
    ...TodoList_nodeFragment_4nog9O
    id
  }
}

fragment TodoList_nodeFragment_4nog9O on NodeWithTodos {
  __isNodeWithTodos: __typename
  __typename
  todos(first: $count, after: $after, sortBy: $sortBy) @connection(key: "TodosList_todos", filter: ["sortBy"]) {
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
query TodoListPaginationQuery($after: String! = "", $count: Int! = 5, $includeSomeOtherField: Boolean, $sortBy: SortByInput, $id: ID!) {
  node(id: $id) {
    __typename
    ...TodoList_nodeFragment_4nog9O
    id
    ... on Node {
      __fragments @client
    }
  }
}

fragment TodoList_nodeFragment_4nog9O on NodeWithTodos {
  __isNodeWithTodos: __typename
  __typename
  todos(first: $count, after: $after, sortBy: $sortBy) @connection(key: "TodosList_todos", filter: ["sortBy"]) {
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
  "value": "sortBy"
},
v6 = {
  "kind": "Variable",
  "name": (v5/*: any*/)
},
v7 = {
  "kind": "Name",
  "value": "id"
},
v8 = {
  "kind": "Variable",
  "name": (v7/*: any*/)
},
v9 = [
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
      "kind": "NamedType",
      "name": {
        "kind": "Name",
        "value": "SortByInput"
      }
    }
  },
  {
    "kind": "VariableDefinition",
    "variable": (v8/*: any*/),
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
v10 = {
  "kind": "Name",
  "value": "node"
},
v11 = [
  {
    "kind": "Argument",
    "name": (v7/*: any*/),
    "value": (v8/*: any*/)
  }
],
v12 = {
  "kind": "Name",
  "value": "__typename"
},
v13 = {
  "kind": "Field",
  "name": (v12/*: any*/)
},
v14 = {
  "kind": "Name",
  "value": "TodoList_nodeFragment_4nog9O"
},
v15 = {
  "kind": "FragmentSpread",
  "name": (v14/*: any*/)
},
v16 = {
  "kind": "Field",
  "name": (v7/*: any*/)
},
v17 = {
  "kind": "NamedType",
  "name": {
    "kind": "Name",
    "value": "NodeWithTodos"
  }
},
v18 = {
  "kind": "Field",
  "alias": {
    "kind": "Name",
    "value": "__isNodeWithTodos"
  },
  "name": (v12/*: any*/)
},
v19 = {
  "kind": "Name",
  "value": "todos"
},
v20 = [
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
  },
  {
    "kind": "Argument",
    "name": (v5/*: any*/),
    "value": (v6/*: any*/)
  }
],
v21 = [
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
              "value": "sortBy",
              "block": false
            }
          ]
        }
      }
    ]
  }
],
v22 = {
  "kind": "Name",
  "value": "edges"
},
v23 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "isCompleted"
  }
},
v24 = {
  "kind": "Name",
  "value": "Todo_todoFragment"
},
v25 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "cursor"
  }
},
v26 = {
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
v27 = {
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
        "variableDefinitions": (v9/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v10/*: any*/),
              "arguments": (v11/*: any*/),
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
        "name": (v14/*: any*/),
        "typeCondition": (v17/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v18/*: any*/),
            (v13/*: any*/),
            {
              "kind": "Field",
              "name": (v19/*: any*/),
              "arguments": (v20/*: any*/),
              "directives": (v21/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": (v22/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": (v10/*: any*/),
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              (v16/*: any*/),
                              (v23/*: any*/),
                              {
                                "kind": "FragmentSpread",
                                "name": (v24/*: any*/)
                              },
                              (v13/*: any*/)
                            ]
                          }
                        },
                        (v25/*: any*/)
                      ]
                    }
                  },
                  (v26/*: any*/),
                  (v16/*: any*/)
                ]
              }
            },
            (v16/*: any*/)
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v24/*: any*/),
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
            (v16/*: any*/),
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "description"
              }
            },
            (v23/*: any*/),
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
        "variableDefinitions": (v9/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v10/*: any*/),
              "arguments": (v11/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v13/*: any*/),
                  (v15/*: any*/),
                  (v16/*: any*/),
                  (v27/*: any*/)
                ]
              }
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v14/*: any*/),
        "typeCondition": (v17/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v18/*: any*/),
            (v13/*: any*/),
            {
              "kind": "Field",
              "name": (v19/*: any*/),
              "arguments": (v20/*: any*/),
              "directives": (v21/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": (v22/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": (v10/*: any*/),
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              (v16/*: any*/),
                              (v23/*: any*/),
                              (v13/*: any*/),
                              (v27/*: any*/)
                            ]
                          }
                        },
                        (v25/*: any*/)
                      ]
                    }
                  },
                  (v26/*: any*/),
                  (v16/*: any*/)
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
      "name": "TodoList_nodeFragment_4nog9O",
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