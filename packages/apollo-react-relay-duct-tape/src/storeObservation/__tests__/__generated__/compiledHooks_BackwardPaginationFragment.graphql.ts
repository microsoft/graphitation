/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type compiledHooks_BackwardPaginationFragment = {
    readonly messages: {
        readonly edges: ReadonlyArray<{
            readonly node: {
                readonly text: string;
            };
        }>;
    };
    readonly id: string;
    readonly " $refType": "compiledHooks_BackwardPaginationFragment";
};
export type compiledHooks_BackwardPaginationFragment$data = compiledHooks_BackwardPaginationFragment;
export type compiledHooks_BackwardPaginationFragment$key = {
    readonly " $data"?: compiledHooks_BackwardPaginationFragment$data | undefined;
    readonly " $fragmentRefs": FragmentRefs<"compiledHooks_BackwardPaginationFragment">;
};
