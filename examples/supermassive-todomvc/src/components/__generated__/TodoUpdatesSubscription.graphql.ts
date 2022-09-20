/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;
import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type TodoUpdatesSubscriptionVariables = {
    limit: number;
};
export type TodoUpdatesSubscriptionResponse = {
    readonly emitTodos: {
        readonly id: string;
        readonly " $fragmentRefs": FragmentRefs<"TodoFragment">;
    } | null;
};
export type TodoUpdatesSubscription = {
    readonly response: TodoUpdatesSubscriptionResponse;
    readonly variables: TodoUpdatesSubscriptionVariables;
};


export const node = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "limit"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "limit",
    "variableName": "limit"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TodoUpdatesSubscription",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Todo",
        "kind": "LinkedField",
        "name": "emitTodos",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "TodoFragment"
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "TodoUpdatesSubscription",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "Todo",
        "kind": "LinkedField",
        "name": "emitTodos",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "text",
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
    ]
  },
  "params": {
    "cacheID": "cae4844186b71886b12eb0c86bac8b60",
    "id": null,
    "metadata": {},
    "name": "TodoUpdatesSubscription",
    "operationKind": "subscription",
    "text": "subscription TodoUpdatesSubscription(\n  $limit: Int!\n) {\n  emitTodos(limit: $limit) {\n    id\n    ...TodoFragment\n  }\n}\n\nfragment TodoFragment on Todo {\n  id\n  text\n  isCompleted\n}\n"
  }
};
})();

export const document = {
  "kind": "Document",
  "definitions": [
    {
      "kind": "OperationDefinition",
      "operation": "subscription",
      "name": {
        "kind": "Name",
        "value": "TodoUpdatesSubscription",
        "loc": {
          "start": 13,
          "end": 36
        }
      },
      "variableDefinitions": [
        {
          "kind": "VariableDefinition",
          "variable": {
            "kind": "Variable",
            "name": {
              "kind": "Name",
              "value": "limit",
              "loc": {
                "start": 38,
                "end": 43
              }
            },
            "loc": {
              "start": 37,
              "end": 43
            }
          },
          "type": {
            "kind": "NonNullType",
            "type": {
              "kind": "NamedType",
              "name": {
                "kind": "Name",
                "value": "Int",
                "loc": {
                  "start": 45,
                  "end": 48
                }
              },
              "loc": {
                "start": 45,
                "end": 48
              }
            },
            "loc": {
              "start": 45,
              "end": 49
            }
          },
          "directives": [],
          "loc": {
            "start": 37,
            "end": 49
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
              "value": "emitTodos",
              "loc": {
                "start": 55,
                "end": 64
              }
            },
            "arguments": [
              {
                "kind": "Argument",
                "name": {
                  "kind": "Name",
                  "value": "limit",
                  "loc": {
                    "start": 65,
                    "end": 70
                  }
                },
                "value": {
                  "kind": "Variable",
                  "name": {
                    "kind": "Name",
                    "value": "limit",
                    "loc": {
                      "start": 73,
                      "end": 78
                    }
                  },
                  "loc": {
                    "start": 72,
                    "end": 78
                  }
                },
                "loc": {
                  "start": 65,
                  "end": 78
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
                    "value": "id",
                    "loc": {
                      "start": 86,
                      "end": 88
                    }
                  },
                  "arguments": [],
                  "directives": [],
                  "loc": {
                    "start": 86,
                    "end": 88
                  }
                },
                {
                  "kind": "FragmentSpread",
                  "name": {
                    "kind": "Name",
                    "value": "TodoFragment",
                    "loc": {
                      "start": 96,
                      "end": 108
                    }
                  },
                  "directives": [],
                  "loc": {
                    "start": 93,
                    "end": 108
                  }
                }
              ],
              "loc": {
                "start": 80,
                "end": 112
              }
            },
            "loc": {
              "start": 55,
              "end": 112
            }
          }
        ],
        "loc": {
          "start": 51,
          "end": 114
        }
      },
      "loc": {
        "start": 0,
        "end": 114
      }
    }
  ],
  "loc": {
    "start": 0,
    "end": 115
  }
};
