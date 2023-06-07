/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type Todo_todoFragment = {
    readonly id: string;
    readonly description: string;
    readonly isCompleted: boolean;
    readonly someOtherField?: string | undefined;
    readonly " $refType": "Todo_todoFragment";
};
export type Todo_todoFragment$data = Todo_todoFragment;
export type Todo_todoFragment$key = {
    readonly " $data"?: Todo_todoFragment$data | undefined;
    readonly " $fragmentRefs": FragmentRefs<"Todo_todoFragment">;
};
