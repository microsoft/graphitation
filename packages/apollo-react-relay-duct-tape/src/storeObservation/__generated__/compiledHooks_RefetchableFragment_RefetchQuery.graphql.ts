/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type compiledHooks_RefetchableFragment_RefetchQueryVariables = {
    avatarSize: number;
    id: string;
};
export type compiledHooks_RefetchableFragment_RefetchQueryResponse = {
    readonly node: {
        readonly " $fragmentRefs": FragmentRefs<"compiledHooks_RefetchableFragment">;
    } | null;
};
export type compiledHooks_RefetchableFragment_RefetchQuery = {
    readonly response: compiledHooks_RefetchableFragment_RefetchQueryResponse;
    readonly variables: compiledHooks_RefetchableFragment_RefetchQueryVariables;
};


/*
query compiledHooks_RefetchableFragment_RefetchQuery($avatarSize: Int!, $id: ID!) {
  node(id: $id) {
    __typename
    ...compiledHooks_RefetchableFragment
    id
  }
}

fragment compiledHooks_RefetchableFragment on User {
  petName
  avatarUrl(size: $avatarSize)
  id
}
*/

/*
query compiledHooks_RefetchableFragment_RefetchQuery($avatarSize: Int!, $id: ID!) {
  node(id: $id) {
    __typename
    ...compiledHooks_RefetchableFragment
    id
    ... on Node {
      __fragments @client
    }
  }
}

fragment compiledHooks_RefetchableFragment on User {
  petName
  avatarUrl(size: $avatarSize)
  id
}
*/

export const documents: import("relay-compiler-language-graphitation").CompiledArtefactModule = {
  "executionQueryDocument": {
    "kind": "Document",
    "definitions": [
      {
        "kind": "OperationDefinition",
        "operation": "query",
        "name": {
          "kind": "Name",
          "value": "compiledHooks_RefetchableFragment_RefetchQuery"
        },
        "variableDefinitions": [
          {
            "kind": "VariableDefinition",
            "variable": {
              "kind": "Variable",
              "name": {
                "kind": "Name",
                "value": "avatarSize"
              }
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "Int"
                }
              }
            }
          },
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
                    "kind": "FragmentSpread",
                    "name": {
                      "kind": "Name",
                      "value": "compiledHooks_RefetchableFragment"
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
          "value": "compiledHooks_RefetchableFragment"
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
                "value": "petName"
              }
            },
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "avatarUrl"
              },
              "arguments": [
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "size"
                  },
                  "value": {
                    "kind": "Variable",
                    "name": {
                      "kind": "Name",
                      "value": "avatarSize"
                    }
                  }
                }
              ]
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
  },
  "watchQueryDocument": {
    "kind": "Document",
    "definitions": [
      {
        "kind": "OperationDefinition",
        "operation": "query",
        "name": {
          "kind": "Name",
          "value": "compiledHooks_RefetchableFragment_RefetchQuery"
        },
        "variableDefinitions": [
          {
            "kind": "VariableDefinition",
            "variable": {
              "kind": "Variable",
              "name": {
                "kind": "Name",
                "value": "avatarSize"
              }
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "Int"
                }
              }
            }
          },
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
                    "kind": "FragmentSpread",
                    "name": {
                      "kind": "Name",
                      "value": "compiledHooks_RefetchableFragment"
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
      },
      {
        "kind": "FragmentDefinition",
        "name": {
          "kind": "Name",
          "value": "compiledHooks_RefetchableFragment"
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
                "value": "petName"
              }
            },
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "avatarUrl"
              },
              "arguments": [
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "size"
                  },
                  "value": {
                    "kind": "Variable",
                    "name": {
                      "kind": "Name",
                      "value": "avatarSize"
                    }
                  }
                }
              ]
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
  },
  "metadata": {
    "rootSelection": "node",
    "mainFragment": {
      "name": "compiledHooks_RefetchableFragment",
      "typeCondition": "User"
    }
  }
};