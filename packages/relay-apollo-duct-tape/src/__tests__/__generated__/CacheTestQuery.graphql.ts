/**
 * @generated SignedSource<<f898bd813747a32018ef9955a8ef2c5a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type CacheTestQuery$variables = {
  conversationId: string;
  includeNestedData?: boolean | null;
};
export type CacheTestQuery$data = {
  readonly conversation: {
    readonly id: string;
    readonly messages?: ReadonlyArray<{
      readonly authorId: string;
      readonly createdAt: string;
      readonly id: string;
      readonly text: string;
    }>;
    readonly title: string;
  };
};
export type CacheTestQuery = {
  response: CacheTestQuery$data;
  variables: CacheTestQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "conversationId"
  },
  {
    "defaultValue": false,
    "kind": "LocalArgument",
    "name": "includeNestedData"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "conversationId"
      }
    ],
    "concreteType": "Conversation",
    "kind": "LinkedField",
    "name": "conversation",
    "plural": false,
    "selections": [
      (v1/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "title",
        "storageKey": null
      },
      {
        "condition": "includeNestedData",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Message",
            "kind": "LinkedField",
            "name": "messages",
            "plural": true,
            "selections": [
              (v1/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "authorId",
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
                "name": "createdAt",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ]
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "CacheTestQuery",
    "selections": (v2/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "CacheTestQuery",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "ebb5290e19380dd9a1e6a625112bd0c0",
    "id": null,
    "metadata": {},
    "name": "CacheTestQuery",
    "operationKind": "query",
    "text": "query CacheTestQuery(\n  $conversationId: String!\n  $includeNestedData: Boolean = false\n) {\n  conversation(id: $conversationId) {\n    id\n    title\n    messages @include(if: $includeNestedData) {\n      id\n      authorId\n      text\n      createdAt\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "bd7fd22ef0c182b6d60f06dde1d7aa1b";

export default node;
