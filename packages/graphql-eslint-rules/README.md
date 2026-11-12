# GraphQL eslint rules

This package contains the following eslint rules:

- missing-apollo-key-fields: Enforce selecting key fields when they are available on a GraphQL object type
- operation-naming-conventions: Enforce descriptive operation names based on the package they reside in
- fragment-naming-conventions: Enforce descriptive fragment names based on the package they reside in

## GraphQL ESLint v4

These rules require `@graphql-eslint/eslint-plugin` 4.4.1 or later in the v4
series, GraphQL 16, ESLint 8.44 or later, and Node.js 18 or later. GraphQL 15 and
GraphQL ESLint v3 are no longer supported. The custom rule options, diagnostics,
suggestions, and autofixes are unchanged.

When migrating from v3, move `parserOptions.schema` and `parserOptions.operations`
to `parserOptions.graphQLConfig.schema` and
`parserOptions.graphQLConfig.documents`, respectively. For example, an ESLint 8
configuration can use:

```json
{
  "parser": "@graphql-eslint/eslint-plugin",
  "parserOptions": {
    "graphQLConfig": {
      "schema": "./schema.graphql",
      "documents": "./src/**/*.graphql"
    }
  }
}
```

An existing on-disk GraphQL Config can supply `schema` and `documents` instead.
The tests use ESLint's `RuleTester` with a local snapshot adapter because v4 no
longer exports `GraphQLRuleTester`.

The monorepo resolves all transitive `@graphql-tools/utils` versions to 12.0.3
to address [GHSA-7mx3-vvmw-hjmv](https://github.com/advisories/GHSA-7mx3-vvmw-hjmv).
An override is still necessary because upstream loaders and code generators
declare older major ranges, including GraphQL ESLint v4's `^10.0.0` range.
