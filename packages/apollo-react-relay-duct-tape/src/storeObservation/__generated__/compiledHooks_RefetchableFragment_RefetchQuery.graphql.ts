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
            },
            "directives": []
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
                      "value": "compiledHooks_RefetchableFragment"
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
          "value": "compiledHooks_RefetchableFragment"
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
              ],
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
            },
            "directives": []
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
                      "value": "compiledHooks_RefetchableFragment"
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
          "value": "compiledHooks_RefetchableFragment"
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
              ],
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
    "rootSelection": "node",
    "mainFragment": {
      "name": "compiledHooks_RefetchableFragment",
      "typeCondition": "User"
    }
  }
};