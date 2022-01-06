/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type hooksTestSubscriptionVariables = {
  id: string;
};
export type hooksTestSubscriptionResponse = {
  readonly userNameChanged: {
    readonly " $fragmentRefs": FragmentRefs<"hooksTestFragment">;
  };
};
export type hooksTestSubscription = {
  readonly response: hooksTestSubscriptionResponse;
  readonly variables: hooksTestSubscriptionVariables;
};


/*
subscription hooksTestSubscription($id: ID!) {
  userNameChanged(id: $id) {
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

/*
subscription hooksTestSubscription($id: ID!) {
  userNameChanged(id: $id) {
    id
    ... on Node {
      __fragments @client
    }
  }
}
*/

export const documents: import("relay-compiler-language-graphitation").CompiledArtefactModule = {
  "executionQueryDocument": {
    "kind": "Document",
    "definitions": [
      {
        "kind": "OperationDefinition",
        "operation": "subscription",
        "name": {
          "kind": "Name",
          "value": "hooksTestSubscription"
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
            }
          }
        ],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "userNameChanged"
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
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "FragmentSpread",
                    "name": {
                      "kind": "Name",
                      "value": "hooksTestFragment"
                    }
                  },
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "id"
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
          "value": "hooksTestFragment"
        },
        "typeCondition": {
          "kind": "NamedType",
          "name": {
            "kind": "Name",
            "value": "User"
          }
        },
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "__typename"
              }
            },
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "id"
              }
            },
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "name"
              }
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
        "operation": "subscription",
        "name": {
          "kind": "Name",
          "value": "hooksTestSubscription"
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
            }
          }
        ],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "userNameChanged"
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
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "id"
                    }
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
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  }
};