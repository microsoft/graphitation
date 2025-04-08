/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type compiledHooks_RefetchableFragment_RefetchQueryVariables = {
    avatarSize: number;
    id: string;
};
export type compiledHooks_RefetchableFragment_RefetchQueryResponse = {
    readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"compiledHooks_RefetchableFragment">;
    } | null;
};
export type compiledHooks_RefetchableFragment_RefetchQuery = {
    readonly response: compiledHooks_RefetchableFragment_RefetchQueryResponse;
    readonly variables: compiledHooks_RefetchableFragment_RefetchQueryVariables;
};


/*
query compiledHooks_RefetchableFragment_RefetchQuery($avatarSize: Int! = 21, $id: ID!) {
  node(id: $id) {
    __typename
    ...compiledHooks_RefetchableFragment_17xSkz
    id
  }
}

fragment compiledHooks_RefetchableFragment_17xSkz on User {
  petName
  avatarUrl(size: $avatarSize)
  id
}
*/

/*
query compiledHooks_RefetchableFragment_RefetchQuery($avatarSize: Int! = 21, $id: ID!) {
  node(id: $id) {
    __typename
    ...compiledHooks_RefetchableFragment_17xSkz
    id
    ... on Node {
      __fragments @client
    }
  }
}

fragment compiledHooks_RefetchableFragment_17xSkz on User {
  petName
  avatarUrl(size: $avatarSize)
  id
}
*/

export const documents: import("@graphitation/apollo-react-relay-duct-tape-compiler").CompiledArtefactModule = (function(){
var v0 = {
  "kind": "Name",
  "value": "compiledHooks_RefetchableFragment_RefetchQuery"
},
v1 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "avatarSize"
  }
},
v2 = {
  "kind": "Name",
  "value": "id"
},
v3 = {
  "kind": "Variable",
  "name": (v2/*: any*/)
},
v4 = [
  {
    "kind": "VariableDefinition",
    "variable": (v1/*: any*/),
    "type": {
      "kind": "NonNullType",
      "type": {
        "kind": "NamedType",
        "name": {
          "kind": "Name",
          "value": "Int"
        }
      }
    },
    "defaultValue": {
      "kind": "IntValue",
      "value": "21"
    }
  },
  {
    "kind": "VariableDefinition",
    "variable": (v3/*: any*/),
    "type": {
      "kind": "NonNullType",
      "type": {
        "kind": "NamedType",
        "name": {
          "kind": "Name",
          "value": "ID"
        }
      }
    }
  }
],
v5 = {
  "kind": "Name",
  "value": "node"
},
v6 = [
  {
    "kind": "Argument",
    "name": (v2/*: any*/),
    "value": (v3/*: any*/)
  }
],
v7 = {
  "kind": "Field",
  "name": {
    "kind": "Name",
    "value": "__typename"
  }
},
v8 = {
  "kind": "Name",
  "value": "compiledHooks_RefetchableFragment_17xSkz"
},
v9 = {
  "kind": "FragmentSpread",
  "name": (v8/*: any*/)
},
v10 = {
  "kind": "Field",
  "name": (v2/*: any*/)
},
v11 = {
  "kind": "FragmentDefinition",
  "name": (v8/*: any*/),
  "typeCondition": {
    "kind": "NamedType",
    "name": {
      "kind": "Name",
      "value": "User"
    }
  },
  "selectionSet": {
    "kind": "SelectionSet",
    "selections": [
      {
        "kind": "Field",
        "name": {
          "kind": "Name",
          "value": "petName"
        }
      },
      {
        "kind": "Field",
        "name": {
          "kind": "Name",
          "value": "avatarUrl"
        },
        "arguments": [
          {
            "kind": "Argument",
            "name": {
              "kind": "Name",
              "value": "size"
            },
            "value": (v1/*: any*/)
          }
        ]
      },
      (v10/*: any*/)
    ]
  }
};
return {
  "executionQueryDocument": {
    "kind": "Document",
    "definitions": [
      {
        "kind": "OperationDefinition",
        "operation": "query",
        "name": (v0/*: any*/),
        "variableDefinitions": (v4/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v5/*: any*/),
              "arguments": (v6/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v7/*: any*/),
                  (v9/*: any*/),
                  (v10/*: any*/)
                ]
              }
            }
          ]
        }
      },
      (v11/*: any*/)
    ]
  },
  "watchQueryDocument": {
    "kind": "Document",
    "definitions": [
      {
        "kind": "OperationDefinition",
        "operation": "query",
        "name": (v0/*: any*/),
        "variableDefinitions": (v4/*: any*/),
        "selectionSet": {
          "kind": "SelectionSet",
          "selections": [
            {
              "kind": "Field",
              "name": (v5/*: any*/),
              "arguments": (v6/*: any*/),
              "selectionSet": {
                "kind": "SelectionSet",
                "selections": [
                  (v7/*: any*/),
                  (v9/*: any*/),
                  (v10/*: any*/),
                  {
                    "kind": "InlineFragment",
                    "typeCondition": {
                      "kind": "NamedType",
                      "name": {
                        "kind": "Name",
                        "value": "Node"
                      }
                    },
                    "selectionSet": {
                      "kind": "SelectionSet",
                      "selections": [
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
                  }
                ]
              }
            }
          ]
        }
      },
      (v11/*: any*/)
    ]
  },
  "metadata": {
    "rootSelection": "node",
    "mainFragment": {
      "name": "compiledHooks_RefetchableFragment_17xSkz",
      "typeCondition": "User"
    }
  }
};
})();

export default documents;