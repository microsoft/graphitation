/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

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
        "value": "useChangeTodoStatusMutation"
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
                "value": "ChangeTodoStatusInput"
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
              "value": "changeTodoStatus"
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
                    "value": "todo"
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