/**
 * @generated SignedSource<<c675b7e068660aff9ce31c1afc19144c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, GraphQLSubscription } from 'relay-runtime';
export type ApolloClientIntegrationTestMessageCreatedSubscription$variables = {
  conversationId: string;
};
export type ApolloClientIntegrationTestMessageCreatedSubscription$data = {
  readonly messageCreated: {
    readonly __typename: "Message";
    readonly id: string;
    readonly text: string;
  };
};
export type ApolloClientIntegrationTestMessageCreatedSubscription = {
  response: ApolloClientIntegrationTestMessageCreatedSubscription$data;
  variables: ApolloClientIntegrationTestMessageCreatedSubscription$variables;
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
        "name": "conversationId",
        "variableName": "conversationId"
      }
    ],
    "concreteType": "Message",
    "kind": "LinkedField",
    "name": "messageCreated",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "__typename",
        "storageKey": null
      },
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
    "name": "ApolloClientIntegrationTestMessageCreatedSubscription",
    "selections": (v1/*: any*/),
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ApolloClientIntegrationTestMessageCreatedSubscription",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "c8266ff3a7444766771efa2046974854",
    "id": null,
    "metadata": {},
    "name": "ApolloClientIntegrationTestMessageCreatedSubscription",
    "operationKind": "subscription",
    "text": "subscription ApolloClientIntegrationTestMessageCreatedSubscription(\n  $conversationId: String!\n) {\n  messageCreated(conversationId: $conversationId) {\n    __typename\n    id\n    text\n  }\n}\n"
  }
};
})();

(node as any).hash = "8d65f7160bf8710351f0c58b76e26c5a";

export default node;
