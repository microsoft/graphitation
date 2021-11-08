/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type compiledHooks_PaginationFragment = {
    readonly petName: string;
    readonly avatarUrl: string;
    readonly conversations: {
        readonly edges: ReadonlyArray<{
            readonly node: {
                readonly title: string;
            };
        }>;
    };
    readonly id: string;
    readonly " $refType": "compiledHooks_PaginationFragment";
};
export type compiledHooks_PaginationFragment$data = compiledHooks_PaginationFragment;
export type compiledHooks_PaginationFragment$key = {
    readonly " $data"?: compiledHooks_PaginationFragment$data;
    readonly " $fragmentRefs": FragmentRefs<"compiledHooks_PaginationFragment">;
};
