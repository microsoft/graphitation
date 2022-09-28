/**
 * @generated SignedSource<<d8010a9c935520a35403bfd568fb08e2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
export type ApolloClientIntegrationTestMutation$variables = {
  id: string;
  title: string;
};
export type ApolloClientIntegrationTestMutation$data = {
  readonly updateConversation: {
    readonly __typename: "Conversation";
    readonly id: string;
    readonly title: string;
  };
};
export type ApolloClientIntegrationTestMutation = {
  response: ApolloClientIntegrationTestMutation$data;
  variables: ApolloClientIntegrationTestMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "title"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      },
      {
        "kind": "Variable",
        "name": "title",
        "variableName": "title"
      }
    ],
    "concreteType": "Conversation",
    "kind": "LinkedField",
    "name": "updateConversation",
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ApolloClientIntegrationTestMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ApolloClientIntegrationTestMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "5acee6fe38dfd1e26c5664267a7bbc0e",
    "id": null,
    "metadata": {},
    "name": "ApolloClientIntegrationTestMutation",
    "operationKind": "mutation",
    "text": "mutation ApolloClientIntegrationTestMutation(\n  $id: String!\n  $title: String!\n) {\n  updateConversation(id: $id, title: $title) {\n    __typename\n    id\n    title\n  }\n}\n"
  }
};
})();

(node as any).hash = "8340c228f733b6cc1f489acb0bac46ce";

export default node;
