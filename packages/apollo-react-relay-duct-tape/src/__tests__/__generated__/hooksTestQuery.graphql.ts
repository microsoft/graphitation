/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;
import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type hooksTestQueryVariables = {
    id: string;
};
export type hooksTestQueryResponse = {
    readonly user: {
        readonly " $fragmentRefs": FragmentRefs<"hooksTestFragment">;
    };
};
export type hooksTestQuery = {
    readonly response: hooksTestQueryResponse;
    readonly variables: hooksTestQueryVariables;
};
