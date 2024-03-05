# A fork of GraphQL Tools Webpack Loader

> A fork of `@graphql-tools/webpack-loader` with supermassive SDL encoding support

A webpack loader to preprocess GraphQL Documents (operations, fragments and SDL)

    yarn add @graphitation/webpack-loader

How is it different from `graphql-tag`? It removes locations entirely, doesn't include sources
(string content of imported files), no warnings about duplicated fragment names and supports more
custom scenarios.

## Options

- noDescription (_default: false_) - removes descriptions
- esModule (_default: false_) - uses import and export statements instead of CommonJS
- supermassiveSDL (_default: false_) - encode SDL for execution with [supermassive](../supermassive)

## Importing GraphQL files

_To add support for importing `.graphql`/`.gql` files, see
[Webpack loading and preprocessing](#webpack-loading-and-preprocessing) below._

Given a file `MyQuery.graphql`

```graphql
query MyQuery {
  ...
}
```

If you have configured
[the webpack @graphitation/webpack-loader](#webpack-loading-and-preprocessing), you can import
modules containing graphQL queries. The imported value will be the pre-built AST.

```ts
import MyQuery from "./query.graphql";
```

### Preprocessing queries and fragments

Preprocessing GraphQL queries and fragments into ASTs at build time can greatly improve load times.

#### Webpack loading and preprocessing

Using the included `@graphitation/webpack-loader` it is possible to maintain query logic that is
separate from the rest of your application logic. With the loader configured, imported graphQL files
will be converted to AST during the webpack build process.

```js
{
  loaders: [
    {
      test: /\.(graphql|gql)$/,
      exclude: /node_modules/,
      loader: '@graphitation/webpack-loader',
      options: {
        /* ... */
      }
    }
  ],
}
```
