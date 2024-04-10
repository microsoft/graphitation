/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type hooksTestMutationVariables = {
  id: string;
  name: string;
};
export type hooksTestMutationResponse = {
  readonly updateUserName: {
    readonly " $fragmentSpreads": FragmentRefs<"hooksTestFragment">;
  };
};
export type hooksTestMutation = {
  readonly response: hooksTestMutationResponse;
  readonly variables: hooksTestMutationVariables;
};
