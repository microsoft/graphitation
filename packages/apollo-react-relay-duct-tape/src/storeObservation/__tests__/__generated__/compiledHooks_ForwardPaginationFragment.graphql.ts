/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type compiledHooks_ForwardPaginationFragment = {
    readonly petName: string;
    readonly avatarUrl: string;
    readonly conversations: {
        readonly edges: ReadonlyArray<{
            readonly node: {
                readonly title: string;
                readonly " $fragmentRefs": FragmentRefs<"compiledHooks_BackwardPaginationFragment">;
            };
        }>;
    };
    readonly id?: string | undefined;
    readonly " $refType": "compiledHooks_ForwardPaginationFragment";
};
export type compiledHooks_ForwardPaginationFragment$data = compiledHooks_ForwardPaginationFragment;
export type compiledHooks_ForwardPaginationFragment$key = {
    readonly " $data"?: compiledHooks_ForwardPaginationFragment$data | undefined;
    readonly " $fragmentRefs": FragmentRefs<"compiledHooks_ForwardPaginationFragment">;
};


import { documents } from "./compiledHooks_ForwardPaginationFragment_PaginationQuery.graphql";
export default documents;