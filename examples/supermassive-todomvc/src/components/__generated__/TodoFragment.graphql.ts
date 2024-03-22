/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type TodoFragment = {
    readonly id: string;
    readonly text: string;
    readonly isCompleted: boolean;
    readonly " $fragmentType": "TodoFragment";
};
export type TodoFragment$data = TodoFragment;
export type TodoFragment$key = {
    readonly " $data"?: TodoFragment$data | undefined;
    readonly " $fragmentSpreads": FragmentRefs<"TodoFragment">;
};
