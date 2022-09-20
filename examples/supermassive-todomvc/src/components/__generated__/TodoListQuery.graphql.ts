/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;
import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type TodoListQueryVariables = {};
export type TodoListQueryResponse = {
    readonly allTodos: ReadonlyArray<{
        readonly id: string;
        readonly " $fragmentRefs": FragmentRefs<"TodoFragment">;
    }>;
};
export type TodoListQuery = {
    readonly response: TodoListQueryResponse;
    readonly variables: TodoListQueryVariables;
};


export const node = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "TodoListQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Todo",
        "kind": "LinkedField",
        "name": "allTodos",
        "plural": true,
        "selections": [
          (v0/*: any*/),
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "TodoFragment"
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "TodoListQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Todo",
        "kind": "LinkedField",
        "name": "allTodos",
        "plural": true,
        "selections": [
          (v0/*: any*/),
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
    "cacheID": "dd9ce123eb8b8ae7b1b1b7878076dc0f",
    "id": null,
    "metadata": {},
    "name": "TodoListQuery",
    "operationKind": "query",
    "text": "query TodoListQuery {\n  allTodos {\n    id\n    ...TodoFragment\n  }\n}\n\nfragment TodoFragment on Todo {\n  id\n  text\n  isCompleted\n}\n"
  }
};
})();

export const document = {
  "kind": "Document",
  "definitions": [
    {
      "kind": "OperationDefinition",
      "operation": "query",
      "name": {
        "kind": "Name",
        "value": "TodoListQuery",
        "loc": {
          "start": 6,
          "end": 19
        }
      },
      "variableDefinitions": [],
      "directives": [],
      "selectionSet": {
        "kind": "SelectionSet",
        "selections": [
          {
            "kind": "Field",
            "name": {
              "kind": "Name",
              "value": "allTodos",
              "loc": {
                "start": 24,
                "end": 32
              }
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
                    "value": "id",
                    "loc": {
                      "start": 39,
                      "end": 41
                    }
                  },
                  "arguments": [],
                  "directives": [],
                  "loc": {
                    "start": 39,
                    "end": 41
                  }
                },
                {
                  "kind": "FragmentSpread",
                  "name": {
                    "kind": "Name",
                    "value": "TodoFragment",
                    "loc": {
                      "start": 49,
                      "end": 61
                    }
                  },
                  "directives": [],
                  "loc": {
                    "start": 46,
                    "end": 61
                  }
                }
              ],
              "loc": {
                "start": 33,
                "end": 65
              }
            },
            "loc": {
              "start": 24,
              "end": 65
            }
          }
        ],
        "loc": {
          "start": 20,
          "end": 67
        }
      },
      "loc": {
        "start": 0,
        "end": 67
      }
    }
  ],
  "loc": {
    "start": 0,
    "end": 68
  }
};
