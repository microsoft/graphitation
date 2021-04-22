/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;
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
