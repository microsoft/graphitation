/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;
export type AppQueryVariables = {};
export type AppQueryResponse = {
    readonly todos: {
        readonly edges: ReadonlyArray<{
            readonly node: {
                readonly id: string;
                readonly description: string;
                readonly isCompleted: boolean;
            };
        }>;
    };
};
export type AppQuery = {
    readonly response: AppQueryResponse;
    readonly variables: AppQueryVariables;
};
