/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type TodoListFooter_todosFragment = {
    readonly uncompletedCount: number;
    readonly " $fragmentType": "TodoListFooter_todosFragment";
};
export type TodoListFooter_todosFragment$data = TodoListFooter_todosFragment;
export type TodoListFooter_todosFragment$key = {
    readonly " $data"?: TodoListFooter_todosFragment$data | undefined;
    readonly " $fragmentSpreads": FragmentRefs<"TodoListFooter_todosFragment">;
};


import { documents } from "./TodoListFooter_todosWatchNodeQuery.graphql";
export default documents;