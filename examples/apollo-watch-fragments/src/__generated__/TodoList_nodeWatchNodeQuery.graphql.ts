/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

/*
query TodoList_nodeWatchNodeQuery($after: String! = "", $first: Int! = 5, $id: ID!) {
  node(id: $id) {
    __typename
    ...TodoList_nodeFragment_2HEEH6
    id
    ... on Node {
      __fragments @client
    }
  }
}

fragment TodoList_nodeFragment_2HEEH6 on NodeWithTodos {
  __isNodeWithTodos: __typename
  __typename
  id
  todos(first: $first, after: $after) {
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
  "kind": "Name",
  "value": "first"
},
v3 = {
  "kind": "Variable",
  "name": (v2/*: any*/)
},
v4 = {
  "kind": "Name",
  "value": "id"
},
v5 = {
  "kind": "Variable",
  "name": (v4/*: any*/)
},
v6 = {
  "kind": "Name",
  "value": "node"
},
v7 = {
  "kind": "Name",
  "value": "__typename"
},
v8 = {
  "kind": "Field",
  "name": (v7/*: any*/)
},
v9 = {
  "kind": "Name",
  "value": "TodoList_nodeFragment_2HEEH6"
},
v10 = {
  "kind": "Field",
  "name": (v4/*: any*/)
},
v11 = {
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
            "variable": (v5/*: any*/),
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
              "name": (v6/*: any*/),
              "arguments": [
                {
                  "kind": "Argument",
                  "name": (v4/*: any*/),
                  "value": (v5/*: any*/)
                }
              ],
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v8/*: any*/),
                  {
                    "kind": "FragmentSpread",
                    "name": (v9/*: any*/)
                  },
                  (v10/*: any*/),
                  (v11/*: any*/)
                ]
              }
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
              "name": (v7/*: any*/)
            },
            (v8/*: any*/),
            (v10/*: any*/),
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "todos"
              },
              "arguments": [
                {
                  "kind": "Argument",
                  "name": (v2/*: any*/),
                  "value": (v3/*: any*/)
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
                          "name": (v6/*: any*/),
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              (v10/*: any*/),
                              {
                                "kind": "Field",
                                "name": {
                                  "kind": "Name",
                                  "value": "isCompleted"
                                }
                              },
                              (v11/*: any*/)
                            ]
                          }
                        }
                      ]
                    }
                  },
                  (v10/*: any*/)
                ]
              }
            }
          ]
        }
      }
    ]
  },
  "metadata": {
    "rootSelection": "node",
    "mainFragment": {
      "name": "TodoList_nodeFragment_2HEEH6",
      "typeCondition": "NodeWithTodos"
    }
  }
};
})();

export default documents;