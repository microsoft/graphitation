/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;
import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type compiledHooks_RefetchableFragment_RefetchQueryVariables = {
    id: string;
};
export type compiledHooks_RefetchableFragment_RefetchQueryResponse = {
    readonly node: {
        readonly " $fragmentRefs": FragmentRefs<"compiledHooks_RefetchableFragment">;
    } | null;
};
export type compiledHooks_RefetchableFragment_RefetchQuery = {
    readonly response: compiledHooks_RefetchableFragment_RefetchQueryResponse;
    readonly variables: compiledHooks_RefetchableFragment_RefetchQueryVariables;
};

/*
query compiledHooks_RefetchableFragment_RefetchQuery($id: ID!) {
  node(id: $id) {
    __typename
    ...compiledHooks_RefetchableFragment
    id
  }
}

fragment compiledHooks_RefetchableFragment on User {
  petName
  id
}

*/
export const executionQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"compiledHooks_RefetchableFragment_RefetchQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},"directives":[]}],"directives":[],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"directives":[],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"},"arguments":[],"directives":[]},{"kind":"FragmentSpread","name":{"kind":"Name","value":"compiledHooks_RefetchableFragment"},"directives":[]},{"kind":"Field","name":{"kind":"Name","value":"id"},"arguments":[],"directives":[]}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"compiledHooks_RefetchableFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"directives":[],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"petName"},"arguments":[],"directives":[]},{"kind":"Field","name":{"kind":"Name","value":"id"},"arguments":[],"directives":[]}]}}]};

/*
query compiledHooks_RefetchableFragment_RefetchQuery($id: ID!) {
  node(id: $id) {
    __typename
    ...compiledHooks_RefetchableFragment
    id
  }
}

fragment compiledHooks_RefetchableFragment on User {
  petName
  id
}

*/
export const watchQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"compiledHooks_RefetchableFragment_RefetchQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},"directives":[]}],"directives":[],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"directives":[],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"},"arguments":[],"directives":[]},{"kind":"FragmentSpread","name":{"kind":"Name","value":"compiledHooks_RefetchableFragment"},"directives":[]},{"kind":"Field","name":{"kind":"Name","value":"id"},"arguments":[],"directives":[]}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"compiledHooks_RefetchableFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"directives":[],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"petName"},"arguments":[],"directives":[]},{"kind":"Field","name":{"kind":"Name","value":"id"},"arguments":[],"directives":[]}]}}]};