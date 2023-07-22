/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type TodoListPaginationQueryVariables = {
    after: string;
    count: number;
    includeSomeOtherField?: boolean | null | undefined;
};
export type TodoListPaginationQueryResponse = {
    readonly " $fragmentRefs": FragmentRefs<"TodoList_queryFragment">;
};
export type TodoListPaginationQuery = {
    readonly response: TodoListPaginationQueryResponse;
    readonly variables: TodoListPaginationQueryVariables;
};


/*
query TodoListPaginationQuery($after: String! = "", $count: Int! = 5, $includeSomeOtherField: Boolean) {
  ...TodoList_queryFragment_2QE1um
}

fragment TodoList_queryFragment_2QE1um on Query {
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
}

fragment Todo_todoFragment on Todo {
  id
  description
  isCompleted
  someOtherField @include(if: $includeSomeOtherField)
}
*/

/*
query TodoListPaginationQuery($after: String! = "", $count: Int! = 5, $includeSomeOtherField: Boolean) {
  ...TodoList_queryFragment_2QE1um
  __fragments @client
}

fragment TodoList_queryFragment_2QE1um on Query {
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
v5 = [
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
  }
],
v6 = {
  "kind": "Name",
  "value": "TodoList_queryFragment_2QE1um"
},
v7 = {
  "kind": "FragmentSpread",
  "name": (v6/*: any*/)
},
v8 = {
  "kind": "NamedType",
  "name": {
    "kind": "Name",
    "value": "Query"
  }
},
v9 = {
  "kind": "Name",
  "value": "todos"
},
v10 = [
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
v11 = [
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
v12 = {
  "kind": "Name",
  "value": "edges"
},
v13 = {
  "kind": "Name",
  "value": "node"
},
v14 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "id"
  }
},
v15 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "isCompleted"
  }
},
v16 = {
  "kind": "Name",
  "value": "Todo_todoFragment"
},
v17 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "__typename"
  }
},
v18 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "cursor"
  }
},
v19 = {
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
v20 = {
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
        "variableDefinitions": (v5/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v7/*: any*/)
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v6/*: any*/),
        "typeCondition": (v8/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v9/*: any*/),
              "arguments": (v10/*: any*/),
              "directives": (v11/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": (v12/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": (v13/*: any*/),
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              (v14/*: any*/),
                              (v15/*: any*/),
                              {
                                "kind": "FragmentSpread",
                                "name": (v16/*: any*/)
                              },
                              (v17/*: any*/)
                            ]
                          }
                        },
                        (v18/*: any*/)
                      ]
                    }
                  },
                  (v19/*: any*/),
                  (v14/*: any*/)
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
            "value": "Todo"
          }
        },
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v14/*: any*/),
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "description"
              }
            },
            (v15/*: any*/),
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
        "variableDefinitions": (v5/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v7/*: any*/),
            (v20/*: any*/)
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v6/*: any*/),
        "typeCondition": (v8/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v9/*: any*/),
              "arguments": (v10/*: any*/),
              "directives": (v11/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": (v12/*: any*/),
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": (v13/*: any*/),
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              (v14/*: any*/),
                              (v15/*: any*/),
                              (v17/*: any*/),
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
                                    (v20/*: any*/)
                                  ]
                                }
                              }
                            ]
                          }
                        },
                        (v18/*: any*/)
                      ]
                    }
                  },
                  (v19/*: any*/),
                  (v14/*: any*/)
                ]
              }
            }
          ]
        }
      }
    ]
  },
  "metadata": {
    "mainFragment": {
      "name": "TodoList_queryFragment_2QE1um",
      "typeCondition": "Query"
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