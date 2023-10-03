/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

/*
query TodoList_nodeWatchNodeQuery($after: String! = "", $count: Int! = 5, $includeSomeOtherField: Boolean, $id: ID!) {
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
  __isNodeWithTodos: __typename
  __typename
  todos(first: $count, after: $after) {
    edges {
      node {
        id
        isCompleted
        ... on Node {
          __fragments @client
        }
      }
    }
    id
  }
  id
}
*/

export const documents: import("@graphitation/apollo-react-relay-duct-tape-compiler").CompiledArtefactModule = (function(){
var v0 = {
  "kind": "Name",
  "value": "after"
},
v1 = {
  "kind": "Variable",
  "name": (v0/*: any*/)
},
v2 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "count"
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
v5 = {
  "kind": "Name",
  "value": "node"
},
v6 = {
  "kind": "Name",
  "value": "__typename"
},
v7 = {
  "kind": "Field",
  "name": (v6/*: any*/)
},
v8 = {
  "kind": "Name",
  "value": "TodoList_nodeFragment_2QE1um"
},
v9 = {
  "kind": "Field",
  "name": (v3/*: any*/)
},
v10 = {
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
  "watchQueryDocument": {
    "kind": "Document",
    "definitions": [
      {
        "kind": "OperationDefinition",
        "operation": "query",
        "name": {
          "kind": "Name",
          "value": "TodoList_nodeWatchNodeQuery"
        },
        "variableDefinitions": [
          {
            "kind": "VariableDefinition",
            "variable": (v1/*: any*/),
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
            "variable": (v2/*: any*/),
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
            "variable": {
              "kind": "Variable",
              "name": {
                "kind": "Name",
                "value": "includeSomeOtherField"
              }
            },
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
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v5/*: any*/),
              "arguments": [
                {
                  "kind": "Argument",
                  "name": (v3/*: any*/),
                  "value": (v4/*: any*/)
                }
              ],
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v7/*: any*/),
                  {
                    "kind": "FragmentSpread",
                    "name": (v8/*: any*/)
                  },
                  (v9/*: any*/),
                  (v10/*: any*/)
                ]
              }
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v8/*: any*/),
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
              "name": (v6/*: any*/)
            },
            (v7/*: any*/),
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "todos"
              },
              "arguments": [
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "first"
                  },
                  "value": (v2/*: any*/)
                },
                {
                  "kind": "Argument",
                  "name": (v0/*: any*/),
                  "value": (v1/*: any*/)
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
                          "name": (v5/*: any*/),
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              (v9/*: any*/),
                              {
                                "kind": "Field",
                                "name": {
                                  "kind": "Name",
                                  "value": "isCompleted"
                                }
                              },
                              (v10/*: any*/)
                            ]
                          }
                        }
                      ]
                    }
                  },
                  (v9/*: any*/)
                ]
              }
            },
            (v9/*: any*/)
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
    }
  }
};
})();

export default documents;