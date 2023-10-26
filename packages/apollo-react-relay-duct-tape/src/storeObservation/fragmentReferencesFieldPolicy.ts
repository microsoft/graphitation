import { FieldReadFunction } from "@apollo/client";

export const fragmentReferencesFieldPolicy: FieldReadFunction = (
  _existingCacheData,
  { variables },
) => {
  if (!variables) {
    return null;
  }

  if (variables.__fragments === undefined) {
    // if (variables.id) {
    //   return { id: variables.id };
    // }
    return variables;
  }

  return variables.__fragments;
};
