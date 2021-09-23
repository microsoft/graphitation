/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;
import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type AppQueryVariables = {};
export type AppQueryResponse = {
    readonly todos: {
        readonly totalCount: number;
        readonly " $fragmentRefs": FragmentRefs<"TodoList_todosFragment" | "TodoListFooter_todosFragment">;
    };
};
export type AppQuery = {
    readonly response: AppQueryResponse;
    readonly variables: AppQueryVariables;
};
