/* tslint:disable */
/* eslint-disable */
// @ts-nocheck
;

/*
query hooksTestWatchNodeQuery($id: ID!) {
  node(id: $id) {
    __typename
    ...hooksTestFragment
    id
  }
}

fragment hooksTestFragment on User {
  __typename
  id
  name
}

*/
export const watchQueryDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"hooksTestWatchNodeQuery"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}},"directives":[]}],"directives":[],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"node"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"directives":[],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"},"arguments":[],"directives":[]},{"kind":"FragmentSpread","name":{"kind":"Name","value":"hooksTestFragment"},"directives":[]},{"kind":"Field","name":{"kind":"Name","value":"id"},"arguments":[],"directives":[]}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"hooksTestFragment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"User"}},"directives":[],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"__typename"},"arguments":[],"directives":[]},{"kind":"Field","name":{"kind":"Name","value":"id"},"arguments":[],"directives":[]},{"kind":"Field","name":{"kind":"Name","value":"name"},"arguments":[],"directives":[]}]}}]};