/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;
import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type TodoRefetchQueryVariables = {
    includeSomeOtherField?: boolean | null;
    id: string;
};
export type TodoRefetchQueryResponse = {
    readonly node: {
        readonly " $fragmentRefs": FragmentRefs<"Todo_todoFragment">;
    } | null;
};
export type TodoRefetchQuery = {
    readonly response: TodoRefetchQueryResponse;
    readonly variables: TodoRefetchQueryVariables;
};

/*
query TodoRefetchQuery($includeSomeOtherField: Boolean, $id: ID!) {
  node(id: $id) {
    __typename
    ...Todo_todoFragment
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
export const executionQueryDocument = {
  "kind": "Document",
  "definitions": [
    {
      "kind": "OperationDefinition",
      "operation": "query",
      "name": {
        "kind": "Name",
        "value": "TodoRefetchQuery"
      },
      "variableDefinitions": [
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
                    "value": "Todo_todoFragment"
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
        "value": "Todo_todoFragment"
      },
      "typeCondition": {
        "kind": "NamedType",
        "name": {
          "kind": "Name",
          "value": "Todo"
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
              "value": "id"
            },
            "arguments": [],
            "directives": []
          },
          {
            "kind": "Field",
            "name": {
              "kind": "Name",
              "value": "description"
            },
            "arguments": [],
            "directives": []
          },
          {
            "kind": "Field",
            "name": {
              "kind": "Name",
              "value": "isCompleted"
            },
            "arguments": [],
            "directives": []
          },
          {
            "kind": "Field",
            "name": {
              "kind": "Name",
              "value": "someOtherField"
            },
            "arguments": [],
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
                    "value": {
                      "kind": "Variable",
                      "name": {
                        "kind": "Name",
                        "value": "includeSomeOtherField"
                      }
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    }
  ]
};

/*
query TodoRefetchQuery($includeSomeOtherField: Boolean, $id: ID!) {
  node(id: $id) {
    __typename
    ...Todo_todoFragment
    id
    ... on Node {
      __fragments @client
    }
  }
}

fragment Todo_todoFragment on Todo {
  id
  description
  isCompleted
  someOtherField @include(if: $includeSomeOtherField)
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
        "value": "TodoRefetchQuery"
      },
      "variableDefinitions": [
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
                    "value": "Todo_todoFragment"
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
        "value": "Todo_todoFragment"
      },
      "typeCondition": {
        "kind": "NamedType",
        "name": {
          "kind": "Name",
          "value": "Todo"
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
              "value": "id"
            },
            "arguments": [],
            "directives": []
          },
          {
            "kind": "Field",
            "name": {
              "kind": "Name",
              "value": "description"
            },
            "arguments": [],
            "directives": []
          },
          {
            "kind": "Field",
            "name": {
              "kind": "Name",
              "value": "isCompleted"
            },
            "arguments": [],
            "directives": []
          },
          {
            "kind": "Field",
            "name": {
              "kind": "Name",
              "value": "someOtherField"
            },
            "arguments": [],
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
                    "value": {
                      "kind": "Variable",
                      "name": {
                        "kind": "Name",
                        "value": "includeSomeOtherField"
                      }
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    }
  ]
};