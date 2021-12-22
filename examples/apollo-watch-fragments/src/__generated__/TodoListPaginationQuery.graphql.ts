/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type TodoListPaginationQueryVariables = {
    after?: string | null;
    count: number;
    includeSomeOtherField?: boolean | null;
};
export type TodoListPaginationQueryResponse = {
    readonly " $fragmentRefs": FragmentRefs<"TodoList_queryFragment">;
};
export type TodoListPaginationQuery = {
    readonly response: TodoListPaginationQueryResponse;
    readonly variables: TodoListPaginationQueryVariables;
};


/*
query TodoListPaginationQuery($after: String, $count: Int!, $includeSomeOtherField: Boolean) {
  ...TodoList_queryFragment
}

fragment TodoList_queryFragment on Query {
  todos(first: $count, after: $after) @connection(key: "TodosList_todos") {
    edges {
      node {
        id
        isCompleted
        ...Todo_todoFragment
        __typename
      }
      cursor
    }
    pageInfo {
      endCursor
      hasNextPage
    }
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

/*
query TodoListPaginationQuery($after: String, $count: Int!, $includeSomeOtherField: Boolean) {
  ...TodoList_queryFragment
  __fragments @client
}

fragment TodoList_queryFragment on Query {
  todos(first: $count, after: $after) @connection(key: "TodosList_todos") {
    edges {
      node {
        id
        isCompleted
        __typename
        ... on Node {
          __fragments @client
        }
      }
      cursor
    }
    pageInfo {
      endCursor
      hasNextPage
    }
    id
  }
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
          "value": "TodoListPaginationQuery"
        },
        "variableDefinitions": [
          {
            "kind": "VariableDefinition",
            "variable": {
              "kind": "Variable",
              "name": {
                "kind": "Name",
                "value": "after"
              }
            },
            "type": {
              "kind": "NamedType",
              "name": {
                "kind": "Name",
                "value": "String"
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
                "value": "count"
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
                "value": "TodoList_queryFragment"
              },
              "directives": []
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": {
          "kind": "Name",
          "value": "TodoList_queryFragment"
        },
        "typeCondition": {
          "kind": "NamedType",
          "name": {
            "kind": "Name",
            "value": "Query"
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
                    "kind": "Variable",
                    "name": {
                      "kind": "Name",
                      "value": "count"
                    }
                  }
                },
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "after"
                  },
                  "value": {
                    "kind": "Variable",
                    "name": {
                      "kind": "Name",
                      "value": "after"
                    }
                  }
                }
              ],
              "directives": [
                {
                  "kind": "Directive",
                  "name": {
                    "kind": "Name",
                    "value": "connection"
                  },
                  "arguments": [
                    {
                      "kind": "Argument",
                      "name": {
                        "kind": "Name",
                        "value": "key"
                      },
                      "value": {
                        "kind": "StringValue",
                        "value": "TodosList_todos",
                        "block": false
                      }
                    }
                  ]
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
                    "arguments": [],
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
                          "arguments": [],
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
                                  "value": "isCompleted"
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
                                  "value": "__typename"
                                },
                                "arguments": [],
                                "directives": []
                              }
                            ]
                          }
                        },
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "cursor"
                          },
                          "arguments": [],
                          "directives": []
                        }
                      ]
                    }
                  },
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "pageInfo"
                    },
                    "arguments": [],
                    "directives": [],
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "endCursor"
                          },
                          "arguments": [],
                          "directives": []
                        },
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "hasNextPage"
                          },
                          "arguments": [],
                          "directives": []
                        }
                      ]
                    }
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
  },
  "watchQueryDocument": {
    "kind": "Document",
    "definitions": [
      {
        "kind": "OperationDefinition",
        "operation": "query",
        "name": {
          "kind": "Name",
          "value": "TodoListPaginationQuery"
        },
        "variableDefinitions": [
          {
            "kind": "VariableDefinition",
            "variable": {
              "kind": "Variable",
              "name": {
                "kind": "Name",
                "value": "after"
              }
            },
            "type": {
              "kind": "NamedType",
              "name": {
                "kind": "Name",
                "value": "String"
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
                "value": "count"
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
                "value": "TodoList_queryFragment"
              },
              "directives": []
            },
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
      },
      {
        "kind": "FragmentDefinition",
        "name": {
          "kind": "Name",
          "value": "TodoList_queryFragment"
        },
        "typeCondition": {
          "kind": "NamedType",
          "name": {
            "kind": "Name",
            "value": "Query"
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
                    "kind": "Variable",
                    "name": {
                      "kind": "Name",
                      "value": "count"
                    }
                  }
                },
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "after"
                  },
                  "value": {
                    "kind": "Variable",
                    "name": {
                      "kind": "Name",
                      "value": "after"
                    }
                  }
                }
              ],
              "directives": [
                {
                  "kind": "Directive",
                  "name": {
                    "kind": "Name",
                    "value": "connection"
                  },
                  "arguments": [
                    {
                      "kind": "Argument",
                      "name": {
                        "kind": "Name",
                        "value": "key"
                      },
                      "value": {
                        "kind": "StringValue",
                        "value": "TodosList_todos",
                        "block": false
                      }
                    }
                  ]
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
                    "arguments": [],
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
                          "arguments": [],
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
                                  "value": "isCompleted"
                                },
                                "arguments": [],
                                "directives": []
                              },
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
                        },
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "cursor"
                          },
                          "arguments": [],
                          "directives": []
                        }
                      ]
                    }
                  },
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "pageInfo"
                    },
                    "arguments": [],
                    "directives": [],
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "endCursor"
                          },
                          "arguments": [],
                          "directives": []
                        },
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "hasNextPage"
                          },
                          "arguments": [],
                          "directives": []
                        }
                      ]
                    }
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
      }
    ]
  },
  "metadata": {
    "mainFragment": {
      "name": "TodoList_queryFragment",
      "typeCondition": "Query"
    },
    "connection": {
      "selectionPath": [
        "todos"
      ],
      "forwardCountVariable": "count",
      "forwardCursorVariable": "after"
    }
  }
};