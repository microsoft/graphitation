/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type hooksTestSubscriptionVariables = {
    id: string;
};
export type hooksTestSubscriptionResponse = {
    readonly userNameChanged: {
        readonly __typename: string;
        readonly id: string;
        readonly name: string;
    };
};
export type hooksTestSubscription = {
    readonly response: hooksTestSubscriptionResponse;
    readonly variables: hooksTestSubscriptionVariables;
};



/*
subscription hooksTestSubscription(
  $id: ID!
) {
  userNameChanged(id: $id) {
    __typename
    id
    name
  }
}
*/

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
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
      }
    ],
    "concreteType": "User",
    "kind": "LinkedField",
    "name": "userNameChanged",
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
        "name": "name",
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
    "name": "hooksTestSubscription",
    "selections": (v1/*: any*/),
    "type": "Subscription",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "hooksTestSubscription",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "ad32680a90ff3dcb6a6060afc511e537",
    "id": null,
    "metadata": {},
    "name": "hooksTestSubscription",
    "operationKind": "subscription",
    "text": "subscription hooksTestSubscription(\n  $id: ID!\n) {\n  userNameChanged(id: $id) {\n    __typename\n    id\n    name\n  }\n}\n"
  }
};
})();
(node as any).hash = '5204570ce28f0c0003d6129fea7a3f0d';
export default node;
