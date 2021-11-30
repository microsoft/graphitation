/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;

export type AddTodoInput = {
    description: string;
};
export type useAddTodoMutationVariables = {
    input: AddTodoInput;
};
export type useAddTodoMutationResponse = {
    readonly addTodo: {
        readonly todoEdge: {
            readonly __typename: string;
            readonly node: {
                readonly id: string;
                readonly isCompleted: boolean;
                readonly description: string;
            };
        } | null;
        readonly todos: {
            readonly id: string;
            readonly totalCount: number;
            readonly uncompletedCount: number;
        };
    } | null;
};
export type useAddTodoMutation = {
    readonly response: useAddTodoMutationResponse;
    readonly variables: useAddTodoMutationVariables;
};


/*
mutation useAddTodoMutation($input: AddTodoInput!) {
  addTodo(input: $input) {
    todoEdge {
      __typename
      node {
        id
        isCompleted
        description
      }
    }
    todos {
      id
      totalCount
      uncompletedCount
    }
  }
}
*/

/*
mutation useAddTodoMutation($input: AddTodoInput!) {
  addTodo(input: $input) {
    todoEdge {
      __typename
      node {
        id
        isCompleted
        description
      }
    }
    todos {
      id
      totalCount
      uncompletedCount
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
        "operation": "mutation",
        "name": {
          "kind": "Name",
          "value": "useAddTodoMutation"
        },
        "variableDefinitions": [
          {
            "kind": "VariableDefinition",
            "variable": {
              "kind": "Variable",
              "name": {
                "kind": "Name",
                "value": "input"
              }
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "AddTodoInput"
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
                "value": "addTodo"
              },
              "arguments": [
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "input"
                  },
                  "value": {
                    "kind": "Variable",
                    "name": {
                      "kind": "Name",
                      "value": "input"
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
                      "value": "todoEdge"
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
                            "value": "__typename"
                          },
                          "arguments": [],
                          "directives": []
                        },
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
                                  "value": "description"
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
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "todos"
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
                            "value": "totalCount"
                          },
                          "arguments": [],
                          "directives": []
                        },
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "uncompletedCount"
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
        }
      }
    ]
  },
  "watchQueryDocument": {
    "kind": "Document",
    "definitions": [
      {
        "kind": "OperationDefinition",
        "operation": "mutation",
        "name": {
          "kind": "Name",
          "value": "useAddTodoMutation"
        },
        "variableDefinitions": [
          {
            "kind": "VariableDefinition",
            "variable": {
              "kind": "Variable",
              "name": {
                "kind": "Name",
                "value": "input"
              }
            },
            "type": {
              "kind": "NonNullType",
              "type": {
                "kind": "NamedType",
                "name": {
                  "kind": "Name",
                  "value": "AddTodoInput"
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
                "value": "addTodo"
              },
              "arguments": [
                {
                  "kind": "Argument",
                  "name": {
                    "kind": "Name",
                    "value": "input"
                  },
                  "value": {
                    "kind": "Variable",
                    "name": {
                      "kind": "Name",
                      "value": "input"
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
                      "value": "todoEdge"
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
                            "value": "__typename"
                          },
                          "arguments": [],
                          "directives": []
                        },
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
                                  "value": "description"
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
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "todos"
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
                            "value": "totalCount"
                          },
                          "arguments": [],
                          "directives": []
                        },
                        {
                          "kind": "Field",
                          "name": {
                            "kind": "Name",
                            "value": "uncompletedCount"
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
        }
      }
    ]
  }
};