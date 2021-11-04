import { TypePolicies } from "@apollo/client";
import { fragmentReferencesFieldPolicy } from "./fragmentReferencesFieldPolicy";
import { nodeFromCacheFieldPolicy } from "./nodeFromCacheFieldPolicy";

export const typePolicies: TypePolicies = {
  Node: {
    fields: {
      __fragments: {
        read: fragmentReferencesFieldPolicy,
      },
    },
  },
  Query: {
    fields: {
      node: {
        read: nodeFromCacheFieldPolicy,
      },
    },
  },
};
