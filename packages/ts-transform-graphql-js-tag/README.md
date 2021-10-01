# ts-transform-graphql-js-tag

TS transform to convert all instances of "@graphitation/graphql-js-tag" or another graphql tag library to parsed document definitions.

This is inspired by [ts-transform-graphql-tag](https://github.com/firede/ts-transform-graphql-tag) library, but modified
to fit our use case better and support transformers.

It differs from many transformers in that it doesn't use underlying tag library at all. Instead it uses graphql-js to parse
definitions and output documents.

## Usage

### with `ts-loader`

In the webpack.config.js file in the section where ts-loader is configured as a loader:

```js
// 1. import `getTransformer` from the module
import { getTransformer } = from "@graphitation/ts-transform-graphql-js-tag"

// 2. create a transformer and add getCustomTransformer method to the loader config
var config = {
  // ...
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        options: {
          // ... other loader's options
          getCustomTransformers: () => ({ before: [getTransformer({})] }),
        },
      },
    ],
  },
  // ...
};
```

### Options

- `graphqlTagModule?: string;` - which graphql tag module you are using. Default: `@graphitation/ts-transform-graphql-js-tag`
- `graphqlTagModuleExport?: "default" | string;` - what export from that module is graphql template tag. Default: `gql`.
- `transformer?: (node: FragmentDefinitionNode | OperationDefinitionNode) => unknown` - optional transformer to apply to graphql definitions before
  emitting them. Note that result should be emittable by TypeScript, so it should be a plain object.
