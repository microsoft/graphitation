/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;

/*
query compiledHooks_ChildWatchNodeQuery($id: ID!) {
  node(id: $id) {
    __typename
    ...compiledHooks_ChildFragment
    id
    ... on Node {
      __fragments @client
    }
  }
}

fragment compiledHooks_ChildFragment on User {
  petName
  id
}

*/
export const watchQueryDocument = {
  "kind": "Document",
  "definitions": [
    {
      "kind": "OperationDefinition",
      "operation": "query",
      "name": {
        "kind": "Name",
        "value": "compiledHooks_ChildWatchNodeQuery"
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
                    "value": "compiledHooks_ChildFragment"
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
        "value": "compiledHooks_ChildFragment"
      },
      "typeCondition": {
        "kind": "NamedType",
        "name": {
          "kind": "Name",
          "value": "User"
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
              "value": "petName"
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
};