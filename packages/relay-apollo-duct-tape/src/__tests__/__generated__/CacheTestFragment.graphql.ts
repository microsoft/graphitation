/**
 * @generated SignedSource<<6a371e9edc96b3a5049dba25bf5d8b8c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type CacheTestFragment$data = {
  readonly id: string;
  readonly title: string;
  readonly " $fragmentType": "CacheTestFragment";
};
export type CacheTestFragment$key = {
  readonly " $data"?: CacheTestFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"CacheTestFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "CacheTestFragment",
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
  "type": "Conversation",
  "abstractKey": null
};

(node as any).hash = "38045e0c13ecb5555e0888ceea978a65";

export default node;
