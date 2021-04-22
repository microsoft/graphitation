# relay-compiler-language-graphitation

A relay-compiler plugin that wraps [the TypeScript plugin]() and augments it slightly for our needs:

- Currently only emit typings, no relay-runtime metadata
- Allow interpolation of GraphQL fragment documents
- Rewrite `@graphitation_test_operation` to relay-compiler's `@raw_response_type` -- _this will likely be removed short-term_
- Rewrite `relay-runtime` import in generated artefacts to `@graphitation/apollo-react-relay-duct-tape`
- Strip `__isFoo` fields from raw response typings, which is something that relay-runtime needs
