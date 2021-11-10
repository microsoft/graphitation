/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;

/*
query compiledHooks_QueryTypeWatchNodeQuery {
  ...compiledHooks_QueryTypeFragment
  __fragments @client
}

fragment compiledHooks_QueryTypeFragment on Query {
  nonNode {
    id
  }
}
*/

export const documents: import("relay-compiler-language-graphitation").CompiledArtefactModule = {
  "watchQueryDocument": {
    "kind": "Document",
    "definitions": [
      {
        "kind": "OperationDefinition",
        "operation": "query",
        "name": {
          "kind": "Name",
          "value": "compiledHooks_QueryTypeWatchNodeQuery"
        },
        "variableDefinitions": [],
        "directives": [],
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "FragmentSpread",
              "name": {
                "kind": "Name",
                "value": "compiledHooks_QueryTypeFragment"
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
          "value": "compiledHooks_QueryTypeFragment"
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
                "value": "nonNode"
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
                  }
                ]
              }
            }
          ]
        }
      }
    ]
  },
  "connectionMetadata": null
};