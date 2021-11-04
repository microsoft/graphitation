/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;
import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type hooksTestQueryVariables = {
    id: string;
};
export type hooksTestQueryResponse = {
    readonly user: {
        readonly " $fragmentRefs": FragmentRefs<"hooksTestFragment">;
    };
};
export type hooksTestQuery = {
    readonly response: hooksTestQueryResponse;
    readonly variables: hooksTestQueryVariables;
};

/*
query hooksTestQuery($id: ID!) {
  user(id: $id) {
    ...hooksTestFragment
    id
  }
}

fragment hooksTestFragment on User {
  __typename
  id
  name
}

*/
export const executionQueryDocument = {
  "kind": "Document",
  "definitions": [
    {
      "kind": "OperationDefinition",
      "operation": "query",
      "name": {
        "kind": "Name",
        "value": "hooksTestQuery"
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
              "value": "user"
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
                  "kind": "FragmentSpread",
                  "name": {
                    "kind": "Name",
                    "value": "hooksTestFragment"
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
        "value": "hooksTestFragment"
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
              "value": "__typename"
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
          },
          {
            "kind": "Field",
            "name": {
              "kind": "Name",
              "value": "name"
            },
            "arguments": [],
            "directives": []
          }
        ]
      }
    }
  ]
};

/*
query hooksTestQuery($id: ID!) {
  user(id: $id) {
    id
    ... on Node {
      __fragments @client
    }
  }
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
        "value": "hooksTestQuery"
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
              "value": "user"
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
    }
  ]
};