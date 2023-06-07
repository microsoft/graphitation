import { FieldReadFunction } from "@apollo/client";

export const fragmentReferencesFieldPolicy: FieldReadFunction = (
  _existingCacheData,
  { variables },
) => {
  return !variables
    ? null
    : variables.__fragments === undefined
    ? variables
    : variables.__fragments;
};
