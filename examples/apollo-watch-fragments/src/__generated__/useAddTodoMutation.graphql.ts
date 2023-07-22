/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

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

export const documents: import("@graphitation/apollo-react-relay-duct-tape-compiler").CompiledArtefactModule = (function(){
var v0 = {
  "kind": "Name",
  "value": "input"
},
v1 = {
  "kind": "Variable",
  "name": (v0/*: any*/)
},
v2 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "id"
  }
},
v3 = {
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
          "variable": (v1/*: any*/),
          "type": {
            "kind": "NonNullType",
            "type": {
              "kind": "NamedType",
              "name": {
                "kind": "Name",
                "value": "AddTodoInput"
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
              "value": "addTodo"
            },
            "arguments": [
              {
                "kind": "Argument",
                "name": (v0/*: any*/),
                "value": (v1/*: any*/)
              }
            ],
            "selectionSet": {
              "kind": "SelectionSet",
              "selections": [
                {
                  "kind": "Field",
                  "name": {
                    "kind": "Name",
                    "value": "todoEdge"
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
                          "value": "node"
                        },
                        "selectionSet": {
                          "kind": "SelectionSet",
                          "selections": [
                            (v2/*: any*/),
                            {
                              "kind": "Field",
                              "name": {
                                "kind": "Name",
                                "value": "isCompleted"
                              }
                            },
                            {
                              "kind": "Field",
                              "name": {
                                "kind": "Name",
                                "value": "description"
                              }
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
                  "selectionSet": {
                    "kind": "SelectionSet",
                    "selections": [
                      (v2/*: any*/),
                      {
                        "kind": "Field",
                        "name": {
                          "kind": "Name",
                          "value": "totalCount"
                        }
                      },
                      {
                        "kind": "Field",
                        "name": {
                          "kind": "Name",
                          "value": "uncompletedCount"
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
    }
  ]
};
return {
  "executionQueryDocument": (v3/*: any*/),
  "watchQueryDocument": (v3/*: any*/)
};
})();

export default documents;