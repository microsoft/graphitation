/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type TodoRefetchQueryVariables = {
    includeSomeOtherField?: boolean | null | undefined;
    id: string;
};
export type TodoRefetchQueryResponse = {
    readonly node: {
        readonly " $fragmentRefs": FragmentRefs<"Todo_todoFragment">;
    } | null;
};
export type TodoRefetchQuery = {
    readonly response: TodoRefetchQueryResponse;
    readonly variables: TodoRefetchQueryVariables;
};


/*
query TodoRefetchQuery($includeSomeOtherField: Boolean, $id: ID!) {
  node(id: $id) {
    __typename
    ...Todo_todoFragment
    id
  }
}

fragment Todo_todoFragment on Todo {
  id
  description
  isCompleted
  someOtherField @include(if: $includeSomeOtherField)
}
*/

/*
query TodoRefetchQuery($includeSomeOtherField: Boolean, $id: ID!) {
  node(id: $id) {
    __typename
    ...Todo_todoFragment
    id
    ... on Node {
      __fragments @client
    }
  }
}

fragment Todo_todoFragment on Todo {
  id
  description
  isCompleted
  someOtherField @include(if: $includeSomeOtherField)
}
*/

export const documents: import("@graphitation/apollo-react-relay-duct-tape-compiler").CompiledArtefactModule = (function(){
var v0 = {
  "kind": "Name",
  "value": "TodoRefetchQuery"
},
v1 = {
  "kind": "Variable",
  "name": {
    "kind": "Name",
    "value": "includeSomeOtherField"
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
      "kind": "NamedType",
      "name": {
        "kind": "Name",
        "value": "Boolean"
      }
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
  "value": "Todo_todoFragment"
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
      "value": "Todo"
    }
  },
  "selectionSet": {
    "kind": "SelectionSet",
    "selections": [
      (v10/*: any*/),
      {
        "kind": "Field",
        "name": {
          "kind": "Name",
          "value": "description"
        }
      },
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
          "value": "someOtherField"
        },
        "directives": [
          {
            "kind": "Directive",
            "name": {
              "kind": "Name",
              "value": "include"
            },
            "arguments": [
              {
                "kind": "Argument",
                "name": {
                  "kind": "Name",
                  "value": "if"
                },
                "value": (v1/*: any*/)
              }
            ]
          }
        ]
      }
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
      "name": "Todo_todoFragment",
      "typeCondition": "Todo"
    }
  }
};
})();

export default documents;