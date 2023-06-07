/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

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

export const documents: import("@graphitation/apollo-react-relay-duct-tape-compiler").CompiledArtefactModule = (function(){
var v0 = {
  "kind": "Name",
  "value": "compiledHooks_QueryTypeFragment"
};
return {
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
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "FragmentSpread",
              "name": (v0/*: any*/)
            },
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "__fragments"
              },
              "directives": [
                {
                  "kind": "Directive",
                  "name": {
                    "kind": "Name",
                    "value": "client"
                  }
                }
              ]
            }
          ]
        }
      },
      {
        "kind": "FragmentDefinition",
        "name": (v0/*: any*/),
        "typeCondition": {
          "kind": "NamedType",
          "name": {
            "kind": "Name",
            "value": "Query"
          }
        },
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": {
                "kind": "Name",
                "value": "nonNode"
              },
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  {
                    "kind": "Field",
                    "name": {
                      "kind": "Name",
                      "value": "id"
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
  "metadata": {
    "mainFragment": {
      "name": "compiledHooks_QueryTypeFragment",
      "typeCondition": "Query"
    }
  }
};
})();