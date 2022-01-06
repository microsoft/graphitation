export * from "./lib/util/RelayRuntimeTypes";
export { GraphQLSubscriptionConfig } from "./lib/subscription/requestSubscription";
export { GraphQLTaggedNode } from "./lib/query/RelayModernGraphQLTag";

/**
 * relay-compiler-language-typescript support for fragment references
 */

export type _RefType<Ref extends string> =
  | {
      " $refType": Ref;
    }
  | {
      " $fragmentType": Ref;
    };

export type _FragmentRefs<Refs extends string> =
  | {
      " $fragmentRefs": FragmentRefs<Refs>;
    }
  | {
      " $fragmentSpreads": FragmentRefs<Refs>;
    };

// This is used in the actual artifacts to define the various fragment references a container holds.
export type FragmentRefs<Refs extends string> = {
  [ref in Refs]: true;
};

// This is a utility type for converting from a data type to a fragment reference that will resolve to that data type.
export type FragmentRef<Fragment> = Fragment extends _RefType<infer U>
  ? _FragmentRefs<U>
  : never;
