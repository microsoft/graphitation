/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type TodoUpdatesSubscriptionVariables = {
    limit: number;
};
export type TodoUpdatesSubscriptionResponse = {
    readonly emitTodos: {
        readonly id: string;
        readonly " $fragmentSpreads": FragmentRefs<"TodoFragment">;
    } | null;
};
export type TodoUpdatesSubscription = {
    readonly response: TodoUpdatesSubscriptionResponse;
    readonly variables: TodoUpdatesSubscriptionVariables;
};
