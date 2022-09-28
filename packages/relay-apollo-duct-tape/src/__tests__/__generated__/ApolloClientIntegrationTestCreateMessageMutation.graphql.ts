/**
 * @generated SignedSource<<ddad2e6248434a52a0c2e907289a02b4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type ApolloClientIntegrationTestCreateMessageMutation$variables = {
  conversationId: string;
};
export type ApolloClientIntegrationTestCreateMessageMutation$data = {
  readonly createMessage: {
    readonly __typename: "Message";
    readonly id: string;
    readonly text: string;
  };
};
export type ApolloClientIntegrationTestCreateMessageMutation = {
  response: ApolloClientIntegrationTestCreateMessageMutation$data;
  variables: ApolloClientIntegrationTestCreateMessageMutation$variables;
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
    "name": "createMessage",
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
    "name": "ApolloClientIntegrationTestCreateMessageMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ApolloClientIntegrationTestCreateMessageMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "eb72077c8db0425239fbab1f2ba870b6",
    "id": null,
    "metadata": {},
    "name": "ApolloClientIntegrationTestCreateMessageMutation",
    "operationKind": "mutation",
    "text": "mutation ApolloClientIntegrationTestCreateMessageMutation(\n  $conversationId: String!\n) {\n  createMessage(conversationId: $conversationId) {\n    __typename\n    id\n    text\n  }\n}\n"
  }
};
})();

(node as any).hash = "a27312165631e6515db577cdeabb3808";

export default node;
