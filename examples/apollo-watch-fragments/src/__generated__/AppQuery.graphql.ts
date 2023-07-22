/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type AppQueryVariables = {
    includeSomeOtherField: boolean;
};
export type AppQueryResponse = {
    readonly todoStats: {
        readonly id: string;
        readonly totalCount: number;
        readonly " $fragmentRefs": FragmentRefs<"TodoListFooter_todosFragment">;
    };
    readonly " $fragmentRefs": FragmentRefs<"TodoList_queryFragment">;
};
export type AppQuery = {
    readonly response: AppQueryResponse;
    readonly variables: AppQueryVariables;
};


/*
query AppQuery($includeSomeOtherField: Boolean!) {
  todoStats: todos(first: 0) {
    id
    totalCount
    ...TodoListFooter_todosFragment
  }
  ...TodoList_queryFragment
}

fragment TodoListFooter_todosFragment on TodosConnection {
  uncompletedCount
  id
}

fragment TodoList_queryFragment on Query {
  todos(first: 5, after: "") @connection(key: "TodosList_todos") {
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
query AppQuery($includeSomeOtherField: Boolean!) {
  todoStats: todos(first: 0) {
    id
    totalCount
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
  "value": "todoStats"
},
v4 = {
  "kind": "Name",
  "value": "todos"
},
v5 = {
  "kind": "Name",
  "value": "first"
},
v6 = [
  {
    "kind": "Argument",
    "name": (v5/*: any*/),
    "value": {
      "kind": "IntValue",
      "value": "0"
    }
  }
],
v7 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "id"
  }
},
v8 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "totalCount"
  }
},
v9 = {
  "kind": "Name",
  "value": "TodoListFooter_todosFragment"
},
v10 = {
  "kind": "Name",
  "value": "TodoList_queryFragment"
},
v11 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "isCompleted"
  }
},
v12 = {
  "kind": "Name",
  "value": "Todo_todoFragment"
},
v13 = {
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
        "variableDefinitions": (v2/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "alias": (v3/*: any*/),
              "name": (v4/*: any*/),
              "arguments": (v6/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v7/*: any*/),
                  (v8/*: any*/),
                  {
                    "kind": "FragmentSpread",
                    "name": (v9/*: any*/)
                  }
                ]
              }
            },
            {
              "kind": "FragmentSpread",
              "name": (v10/*: any*/)
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v9/*: any*/),
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
            (v7/*: any*/)
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
            "value": "Query"
          }
        },
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v4/*: any*/),
              "arguments": [
                {
                  "kind": "Argument",
                  "name": (v5/*: any*/),
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
                              (v7/*: any*/),
                              (v11/*: any*/),
                              {
                                "kind": "FragmentSpread",
                                "name": (v12/*: any*/)
                              },
                              {
                                "kind": "Field",
                                "name": {
                                  "kind": "Name",
                                  "value": "__typename"
                                }
                              }
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
                  (v7/*: any*/)
                ]
              }
            }
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
            "value": "Todo"
          }
        },
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            (v7/*: any*/),
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "description"
              }
            },
            (v11/*: any*/),
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
              "alias": (v3/*: any*/),
              "name": (v4/*: any*/),
              "arguments": (v6/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v7/*: any*/),
                  (v8/*: any*/),
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
                        (v13/*: any*/)
                      ]
                    }
                  }
                ]
              }
            },
            (v13/*: any*/)
          ]
        }
      }
    ]
  }
};
})();

export default documents;