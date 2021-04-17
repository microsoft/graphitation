# graphql-js-tag

A simple graphql-js AST based `graphql` tagged template function.

This version makes a few assumptions that allow it to make some optimizations:

- Documents will not be mutated once created, which allows copying interpolated documents by reference instead of value.
- Documents are named uniquely and defined only once, which makes de-duping by reference possible.

Other optimizations:

- The `invariant` call can be stripped out when applicable.
- Inline documents are parsed ahead-of-time and have their AST inlined.
