/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;
import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type TodoList_todosFragment = {
    readonly edges: ReadonlyArray<{
        readonly node: {
            readonly id: string;
            readonly isCompleted: boolean;
            readonly " $fragmentRefs": FragmentRefs<"Todo_todoFragment">;
        };
    }>;
    readonly id: string;
    readonly " $refType": "TodoList_todosFragment";
};
export type TodoList_todosFragment$data = TodoList_todosFragment;
export type TodoList_todosFragment$key = {
    readonly " $data"?: TodoList_todosFragment$data;
    readonly " $fragmentRefs": FragmentRefs<"TodoList_todosFragment">;
};
