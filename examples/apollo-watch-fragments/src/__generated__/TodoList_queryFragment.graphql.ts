/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type TodoList_queryFragment = {
    readonly todos: {
        readonly edges: ReadonlyArray<{
            readonly node: {
                readonly id: string;
                readonly isCompleted: boolean;
                readonly " $fragmentRefs": FragmentRefs<"Todo_todoFragment">;
            };
        }>;
    };
    readonly " $refType": "TodoList_queryFragment";
};
export type TodoList_queryFragment$data = TodoList_queryFragment;
export type TodoList_queryFragment$key = {
    readonly " $data"?: TodoList_queryFragment$data | undefined;
    readonly " $fragmentRefs": FragmentRefs<"TodoList_queryFragment">;
};
