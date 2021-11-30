/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;

/*
query TodoListFooter_todosWatchNodeQuery($id: ID!) {
  node(id: $id) {
    __typename
    ...TodoListFooter_todosFragment
    id
    ... on Node {
      __fragments @client
    }
  }
}

fragment TodoListFooter_todosFragment on TodosConnection {
  uncompletedCount
  id
}
*/

export const documents: import("relay-compiler-language-graphitation").CompiledArtefactModule = {
  "watchQueryDocument": {
    "kind": "Document",
    "definitions": [
      {
        "kind": "OperationDefinition",
        "operation": "query",
        "name": {
          "kind": "Name",
          "value": "TodoListFooter_todosWatchNodeQuery"
        },
        "variableDefinitions": [
          {
            "kind": "VariableDefinition",
            "variable": {
              "kind": "Variable",
              "name": {
                "kind": "Name",
                "value": "id"
              }
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "ID"
                }
              }
            },
            "directives": []
          }
        ],
        "directives": [],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "node"
              },
              "arguments": [
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "id"
                  },
                  "value": {
                    "kind": "Variable",
                    "name": {
                      "kind": "Name",
                      "value": "id"
                    }
                  }
                }
              ],
              "directives": [],
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "__typename"
                    },
                    "arguments": [],
                    "directives": []
                  },
                  {
                    "kind": "FragmentSpread",
                    "name": {
                      "kind": "Name",
                      "value": "TodoListFooter_todosFragment"
                    },
                    "directives": []
                  },
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "id"
                    },
                    "arguments": [],
                    "directives": []
                  },
                  {
                    "kind": "InlineFragment",
                    "typeCondition": {
                      "kind": "NamedType",
                      "name": {
                        "kind": "Name",
                        "value": "Node"
                      }
                    },
                    "directives": [],
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "__fragments"
                          },
                          "arguments": [],
                          "directives": [
                            {
                              "kind": "Directive",
                              "name": {
                                "kind": "Name",
                                "value": "client"
                              },
                              "arguments": []
                            }
                          ]
                        }
                      ]
                    }
                  }
                ]
              }
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": {
          "kind": "Name",
          "value": "TodoListFooter_todosFragment"
        },
        "typeCondition": {
          "kind": "NamedType",
          "name": {
            "kind": "Name",
            "value": "TodosConnection"
          }
        },
        "directives": [],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "uncompletedCount"
              },
              "arguments": [],
              "directives": []
            },
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "id"
              },
              "arguments": [],
              "directives": []
            }
          ]
        }
      }
    ]
  },
  "metadata": {
    "rootSelection": "node"
  }
};