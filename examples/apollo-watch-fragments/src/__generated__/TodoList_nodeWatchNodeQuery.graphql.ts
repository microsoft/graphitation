/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

/*
query TodoList_nodeWatchNodeQuery($after: String, $id: ID!) {
  node(id: $id) {
    __typename
    ...TodoList_nodeFragment
    id
    ... on Node {
      __fragments @client
    }
  }
}

fragment TodoList_nodeFragment on NodeWithTodos {
  __isNodeWithTodos: __typename
  __typename
  id
  todos(first: 5, after: $after) {
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
  "value": "id"
},
v3 = {
  "kind": "Variable",
  "name": (v2/*: any*/)
},
v4 = {
  "kind": "Name",
  "value": "node"
},
v5 = {
  "kind": "Name",
  "value": "__typename"
},
v6 = {
  "kind": "Field",
  "name": (v5/*: any*/)
},
v7 = {
  "kind": "Name",
  "value": "TodoList_nodeFragment"
},
v8 = {
  "kind": "Field",
  "name": (v2/*: any*/)
},
v9 = {
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
              "kind": "NamedType",
              "name": {
                "kind": "Name",
                "value": "String"
              }
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
              "name": (v4/*: any*/),
              "arguments": [
                {
                  "kind": "Argument",
                  "name": (v2/*: any*/),
                  "value": (v3/*: any*/)
                }
              ],
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v6/*: any*/),
                  {
                    "kind": "FragmentSpread",
                    "name": (v7/*: any*/)
                  },
                  (v8/*: any*/),
                  (v9/*: any*/)
                ]
              }
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v7/*: any*/),
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
              "name": (v5/*: any*/)
            },
            (v6/*: any*/),
            (v8/*: any*/),
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
                  "value": {
                    "kind": "IntValue",
                    "value": "5"
                  }
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
                          "name": (v4/*: any*/),
                          "selectionSet": {
                            "kind": "SelectionSet",
                            "selections": [
                              (v8/*: any*/),
                              {
                                "kind": "Field",
                                "name": {
                                  "kind": "Name",
                                  "value": "isCompleted"
                                }
                              },
                              (v9/*: any*/)
                            ]
                          }
                        }
                      ]
                    }
                  },
                  (v8/*: any*/)
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
      "name": "TodoList_nodeFragment",
      "typeCondition": "NodeWithTodos"
    }
  }
};
})();

export default documents;