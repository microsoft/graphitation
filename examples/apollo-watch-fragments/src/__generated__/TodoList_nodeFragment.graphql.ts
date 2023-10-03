/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type TodoList_nodeFragment = {
    readonly __typename: string;
    readonly todos: {
        readonly edges: ReadonlyArray<{
            readonly node: {
                readonly id: string;
                readonly isCompleted: boolean;
                readonly " $fragmentRefs": FragmentRefs<"Todo_todoFragment">;
            };
        }>;
    };
    readonly " $refType": "TodoList_nodeFragment";
};
export type TodoList_nodeFragment$data = TodoList_nodeFragment;
export type TodoList_nodeFragment$key = {
    readonly " $data"?: TodoList_nodeFragment$data | undefined;
    readonly " $fragmentRefs": FragmentRefs<"TodoList_nodeFragment">;
};


import { documents } from "./TodoList_nodeWatchNodeQuery.graphql";
export default documents;