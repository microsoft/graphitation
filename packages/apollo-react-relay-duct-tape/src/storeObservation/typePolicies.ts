import { TypePolicies } from "@apollo/client";
import { fragmentReferencesFieldPolicy } from "./fragmentReferencesFieldPolicy";
import { nodeFromCacheFieldPolicy } from "./nodeFromCacheFieldPolicy";

// TODO: Can we configure merge to ignore a field? Specifically __fragments
//       should never be written.
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
      __fragments: {
        read: fragmentReferencesFieldPolicy,
      },
      node: {
        read: nodeFromCacheFieldPolicy,
      },
    },
  },
};
