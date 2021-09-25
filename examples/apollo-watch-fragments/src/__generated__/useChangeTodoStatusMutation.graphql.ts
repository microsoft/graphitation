/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;
export type ChangeTodoStatusInput = {
    id: string;
    isCompleted: boolean;
};
export type useChangeTodoStatusMutationVariables = {
    input: ChangeTodoStatusInput;
};
export type useChangeTodoStatusMutationResponse = {
    readonly changeTodoStatus: {
        readonly todo: {
            readonly id: string;
            readonly isCompleted: boolean;
        };
    } | null;
};
export type useChangeTodoStatusMutation = {
    readonly response: useChangeTodoStatusMutationResponse;
    readonly variables: useChangeTodoStatusMutationVariables;
};
