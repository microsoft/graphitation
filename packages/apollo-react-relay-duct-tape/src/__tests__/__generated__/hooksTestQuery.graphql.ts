/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from "relay-runtime";
export type hooksTestQueryVariables = {
    id: string;
};
export type hooksTestQueryResponse = {
    readonly user: {
        readonly __typename: string;
        readonly id: string;
        readonly name: string;
    };
};
export type hooksTestQuery = {
    readonly response: hooksTestQueryResponse;
    readonly variables: hooksTestQueryVariables;
};



/*
query hooksTestQuery(
  $id: ID!
) {
  user(id: $id) {
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
    "name": "user",
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
    "name": "hooksTestQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "hooksTestQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "6c639dbf8d0688927412bd37fc17a021",
    "id": null,
    "metadata": {},
    "name": "hooksTestQuery",
    "operationKind": "query",
    "text": "query hooksTestQuery(\n  $id: ID!\n) {\n  user(id: $id) {\n    __typename\n    id\n    name\n  }\n}\n"
  }
};
})();
(node as any).hash = '7a1aec44ec5fa0e3d845c54f5d71d236';
export default node;
