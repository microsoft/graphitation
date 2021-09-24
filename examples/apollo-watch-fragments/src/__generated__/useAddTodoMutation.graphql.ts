/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;
export type AddTodoInput = {
    description: string;
};
export type useAddTodoMutationVariables = {
    input: AddTodoInput;
};
export type useAddTodoMutationResponse = {
    readonly addTodo: {
        readonly todoEdge: {
            readonly __typename: string;
            readonly node: {
                readonly id: string;
                readonly isCompleted: boolean;
                readonly description: string;
            };
        } | null;
    } | null;
};
export type useAddTodoMutation = {
    readonly response: useAddTodoMutationResponse;
    readonly variables: useAddTodoMutationVariables;
};
