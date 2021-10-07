// NOTE: Because we use CommonJS [in TMP], exports are not tree shaken and thus we can't
//       export things here that should only be used in build-time tooling.
export * from "./nodeFromCacheFieldPolicy";
export * from "./shallowCompareFragmentReferences";
