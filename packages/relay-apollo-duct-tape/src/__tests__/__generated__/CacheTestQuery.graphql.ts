/**
 * @generated SignedSource<<d8c1871f44889bc79aa736aa9bfbf907>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type CacheTestQuery$variables = {
  conversationId: string;
};
export type CacheTestQuery$data = {
  readonly conversation: {
    readonly id: string;
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
  }
],
v1 = [
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
        "name": "title",
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
    "name": "CacheTestQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "CacheTestQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "fcf2b6d1cc7f31b0422ac0b9c4ee9a53",
    "id": null,
    "metadata": {},
    "name": "CacheTestQuery",
    "operationKind": "query",
    "text": "query CacheTestQuery(\n  $conversationId: String!\n) {\n  conversation(id: $conversationId) {\n    id\n    title\n  }\n}\n"
  }
};
})();

(node as any).hash = "93325d481f0ab6e2f454646f0039910d";

export default node;
