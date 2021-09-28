/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;
import { FragmentRefs } from "@graphitation/apollo-react-relay-duct-tape";
export type Todo_todoWatchNodeQueryVariables = {
    id: string;
};
export type Todo_todoWatchNodeQueryResponse = {
    readonly node: {
        readonly " $fragmentRefs": FragmentRefs<"Todo_todoFragment">;
    } | null;
};
export type Todo_todoWatchNodeQuery = {
    readonly response: Todo_todoWatchNodeQueryResponse;
    readonly variables: Todo_todoWatchNodeQueryVariables;
};

/*
query Todo_todoWatchNodeQuery($id: ID!) {
  node(id: $id) {
    __typename
    ...Todo_todoFragment
    id
  }
}

fragment Todo_todoFragment on Todo {
  id
  description
  isCompleted
}

*/
export const watchQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Todo_todoWatchNodeQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},"directives":[]}],"directives":[],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"directives":[],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"},"arguments":[],"directives":[]},{"kind":"FragmentSpread","name":{"kind":"Name","value":"Todo_todoFragment"},"directives":[]},{"kind":"Field","name":{"kind":"Name","value":"id"},"arguments":[],"directives":[]}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"Todo_todoFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Todo"}},"directives":[],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"},"arguments":[],"directives":[]},{"kind":"Field","name":{"kind":"Name","value":"description"},"arguments":[],"directives":[]},{"kind":"Field","name":{"kind":"Name","value":"isCompleted"},"arguments":[],"directives":[]}]}}]};