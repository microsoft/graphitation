// THIS FILE IS GENERATED BY graphql-codegen. DO NOT MODIFY!
// RUN `yarn generate:interfaces` from the package root to update it
// See <PACKAGE_ROOT>/codegen.yml for details
/* eslint-disable */
// @ts-nocheck

import * as Types from '../src/__generated__/types.js';

import { DocumentNode } from "graphql";
export type TodoUpdateStatusMutationVariables = Types.Exact<{
  input: Types.SetTodoCompletedInput;
}>;


export type TodoUpdateStatusMutation = { readonly setTodoCompleted: { readonly __typename: 'SetTodoCompletedSuccess', readonly todo: { readonly __typename: 'Todo', readonly id: string, readonly isCompleted: boolean } } | { readonly __typename: 'SetTodoCompletedFailure', readonly reason: string } };

export const TodoUpdateStatusMutationDocument: DocumentNode = (function(){
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
    "value": "__typename"
  },
  "arguments": ([]/*: any*/),
  "directives": ([]/*: any*/)
},
v3 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v5 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": null,
    "kind": "LinkedField",
    "name": "setTodoCompleted",
    "plural": false,
    "selections": [
      (v4/*: any*/),
      {
        "kind": "InlineFragment",
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Todo",
            "kind": "LinkedField",
            "name": "todo",
            "plural": false,
            "selections": [
              (v4/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "id",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "isCompleted",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "type": "SetTodoCompletedSuccess",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "reason",
            "storageKey": null
          }
        ],
        "type": "SetTodoCompletedFailure",
        "abstractKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "kind": "Document",
  "definitions": [
    {
      "kind": "OperationDefinition",
      "operation": "mutation",
      "name": {
        "kind": "Name",
        "value": "TodoUpdateStatusMutation"
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
                "value": "SetTodoCompletedInput"
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
              "value": "setTodoCompleted"
            },
            "arguments": [
              {
                "kind": "Argument",
                "name": (v0/*: any*/),
                "value": (v1/*: any*/)
              }
            ],
            "directives": [],
            "selectionSet": {
              "kind": "SelectionSet",
              "selections": [
                (v2/*: any*/),
                {
                  "kind": "InlineFragment",
                  "typeCondition": {
                    "kind": "NamedType",
                    "name": {
                      "kind": "Name",
                      "value": "SetTodoCompletedSuccess"
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
                          "value": "todo"
                        },
                        "arguments": [],
                        "directives": [],
                        "selectionSet": {
                          "kind": "SelectionSet",
                          "selections": [
                            (v2/*: any*/),
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
                      }
                    ]
                  }
                },
                {
                  "kind": "InlineFragment",
                  "typeCondition": {
                    "kind": "NamedType",
                    "name": {
                      "kind": "Name",
                      "value": "SetTodoCompletedFailure"
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
                          "value": "reason"
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
  ],
  "__relay": {
    "fragment": {
      "argumentDefinitions": (v3/*: any*/),
      "kind": "Fragment",
      "metadata": null,
      "name": "TodoUpdateStatusMutation",
      "selections": (v5/*: any*/),
      "type": "Mutation",
      "abstractKey": null
    },
    "kind": "Request",
    "operation": {
      "argumentDefinitions": (v3/*: any*/),
      "kind": "Operation",
      "name": "TodoUpdateStatusMutation",
      "selections": (v5/*: any*/)
    },
    "params": {
      "cacheID": "d41d8cd98f00b204e9800998ecf8427e",
      "metadata": {},
      "name": "TodoUpdateStatusMutation",
      "operationKind": "mutation",
      "text": ""
    }
  }
};
})();