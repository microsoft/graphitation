/**
 * @generated SignedSource<<f4d462f26ae3b10862879ff3f108615f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, GraphQLSubscription } from 'relay-runtime';
export type ApolloClientIntegrationTestConversationUpdatedSubscription$variables = {};
export type ApolloClientIntegrationTestConversationUpdatedSubscription$data = {
  readonly conversationUpdated: {
    readonly __typename: "Conversation";
    readonly id: string;
    readonly title: string;
  };
};
export type ApolloClientIntegrationTestConversationUpdatedSubscription = {
  response: ApolloClientIntegrationTestConversationUpdatedSubscription$data;
  variables: ApolloClientIntegrationTestConversationUpdatedSubscription$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "Conversation",
    "kind": "LinkedField",
    "name": "conversationUpdated",
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
        "name": "title",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ApolloClientIntegrationTestConversationUpdatedSubscription",
    "selections": (v0/*: any*/),
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ApolloClientIntegrationTestConversationUpdatedSubscription",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "0391827416e2014e9019f1df748963bf",
    "id": null,
    "metadata": {},
    "name": "ApolloClientIntegrationTestConversationUpdatedSubscription",
    "operationKind": "subscription",
    "text": "subscription ApolloClientIntegrationTestConversationUpdatedSubscription {\n  conversationUpdated {\n    __typename\n    id\n    title\n  }\n}\n"
  }
};
})();

(node as any).hash = "07844b9b217ac49a3f507ac86554029e";

export default node;
