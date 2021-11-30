/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;

export type ChangeTodoStatusInput = {
    id: string;
    isCompleted: boolean;
};
export type useChangeTodoStatusMutationVariables = {
    input: ChangeTodoStatusInput;
};
export type useChangeTodoStatusMutationResponse = {
    readonly changeTodoStatus: {
        readonly todo: {
            readonly id: string;
            readonly isCompleted: boolean;
        };
        readonly todos: {
            readonly id: string;
            readonly totalCount: number;
            readonly uncompletedCount: number;
        };
    } | null;
};
export type useChangeTodoStatusMutation = {
    readonly response: useChangeTodoStatusMutationResponse;
    readonly variables: useChangeTodoStatusMutationVariables;
};


/*
mutation useChangeTodoStatusMutation($input: ChangeTodoStatusInput!) {
  changeTodoStatus(input: $input) {
    todo {
      id
      isCompleted
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
mutation useChangeTodoStatusMutation($input: ChangeTodoStatusInput!) {
  changeTodoStatus(input: $input) {
    todo {
      id
      isCompleted
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
          "value": "useChangeTodoStatusMutation"
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
                  "value": "ChangeTodoStatusInput"
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
                "value": "changeTodoStatus"
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
                      "value": "todo"
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
          "value": "useChangeTodoStatusMutation"
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
                  "value": "ChangeTodoStatusInput"
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
                "value": "changeTodoStatus"
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
                      "value": "todo"
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