import { FieldReadFunction, TypePolicies } from "@apollo/client";
import { fragmentReferencesFieldPolicy } from "./fragmentReferencesFieldPolicy";
import {
  nodeFromCacheFieldPolicyWithDefaultApolloClientStoreKeys,
  nodeFromCacheFieldPolicyWithGlobalObjectIdStoreKeys,
} from "./nodeFromCacheFieldPolicy";

// TODO: Can we configure merge to ignore a field? Specifically __fragments
//       should never be written.
function generateTypePolicies(fieldReadFn: FieldReadFunction): TypePolicies {
  return {
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
          read: fieldReadFn,
        },
      },
    },
  };
}

export const typePoliciesWithDefaultApolloClientStoreKeys = generateTypePolicies(
  nodeFromCacheFieldPolicyWithDefaultApolloClientStoreKeys
);

export const typePoliciesWithGlobalObjectIdStoreKeys = generateTypePolicies(
  nodeFromCacheFieldPolicyWithGlobalObjectIdStoreKeys
);
