/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;
import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type TodoFragment = {
    readonly id: string;
    readonly text: string;
    readonly isCompleted: boolean;
    readonly " $refType": "TodoFragment";
};
export type TodoFragment$data = TodoFragment;
export type TodoFragment$key = {
    readonly " $data"?: TodoFragment$data | undefined;
    readonly " $fragmentRefs": FragmentRefs<"TodoFragment">;
};


export const node = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "TodoFragment",
  "selections": [
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
  "type": "Todo",
  "abstractKey": null
};

export const document = {
  "kind": "Document",
  "definitions": [
    {
      "kind": "FragmentDefinition",
      "name": {
        "kind": "Name",
        "value": "TodoFragment",
        "loc": {
          "start": 9,
          "end": 21
        }
      },
      "typeCondition": {
        "kind": "NamedType",
        "name": {
          "kind": "Name",
          "value": "Todo",
          "loc": {
            "start": 25,
            "end": 29
          }
        },
        "loc": {
          "start": 25,
          "end": 29
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
              "value": "id",
              "loc": {
                "start": 34,
                "end": 36
              }
            },
            "arguments": [],
            "directives": [],
            "loc": {
              "start": 34,
              "end": 36
            }
          },
          {
            "kind": "Field",
            "name": {
              "kind": "Name",
              "value": "text",
              "loc": {
                "start": 39,
                "end": 43
              }
            },
            "arguments": [],
            "directives": [],
            "loc": {
              "start": 39,
              "end": 43
            }
          },
          {
            "kind": "Field",
            "name": {
              "kind": "Name",
              "value": "isCompleted",
              "loc": {
                "start": 46,
                "end": 57
              }
            },
            "arguments": [],
            "directives": [],
            "loc": {
              "start": 46,
              "end": 57
            }
          }
        ],
        "loc": {
          "start": 30,
          "end": 59
        }
      },
      "loc": {
        "start": 0,
        "end": 59
      }
    }
  ],
  "loc": {
    "start": 0,
    "end": 60
  }
};
