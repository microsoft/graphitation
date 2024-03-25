/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type hooksTestSubscriptionVariables = {
  id: string;
};
export type hooksTestSubscriptionResponse = {
  readonly userNameChanged: {
    readonly " $fragmentSpreads": FragmentRefs<"hooksTestFragment">;
  };
};
export type hooksTestSubscription = {
  readonly response: hooksTestSubscriptionResponse;
  readonly variables: hooksTestSubscriptionVariables;
};
