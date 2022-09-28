/**
 * @generated SignedSource<<e7a3b5517b4b7634f838f53133007470>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type ApolloClientIntegrationTestQuery$variables = {
  id: string;
};
export type ApolloClientIntegrationTestQuery$data = {
  readonly conversation: {
    readonly __typename: "Conversation";
    readonly id: string;
    readonly messages: ReadonlyArray<{
      readonly __typename: "Message";
      readonly id: string;
      readonly text: string;
    }>;
    readonly title: string;
  };
};
export type ApolloClientIntegrationTestQuery = {
  response: ApolloClientIntegrationTestQuery$data;
  variables: ApolloClientIntegrationTestQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      }
    ],
    "concreteType": "Conversation",
    "kind": "LinkedField",
    "name": "conversation",
    "plural": false,
    "selections": [
      (v1/*: any*/),
      (v2/*: any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "title",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "Message",
        "kind": "LinkedField",
        "name": "messages",
        "plural": true,
        "selections": [
          (v1/*: any*/),
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "text",
            "storageKey": null
          }
        ],
        "storageKey": null
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
    "name": "ApolloClientIntegrationTestQuery",
    "selections": (v3/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ApolloClientIntegrationTestQuery",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "3f6b1a4cbb50ccadac632bd6442d48f6",
    "id": null,
    "metadata": {},
    "name": "ApolloClientIntegrationTestQuery",
    "operationKind": "query",
    "text": "query ApolloClientIntegrationTestQuery(\n  $id: String!\n) {\n  conversation(id: $id) {\n    __typename\n    id\n    title\n    messages {\n      __typename\n      id\n      text\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "81542fd3e9306a1e7125d0d7e24eabca";

export default node;
