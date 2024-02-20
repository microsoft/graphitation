# @graphitation/embedded-document-artefact-loader

This is a simple set of webpack/jest loaders that will replace embedded GraphQL
documents with an import of an external compiled artefact file. It is meant to
remain agnostic of a specific AST form, so it can work with pipelines that use
babel, tsc, esbuild, swc, etc.

It works for `@graphitation/apollo-react-relay-duct-tape` and `react-relay`.

## webpack

```js
const webpackConfig = {
  module: {
    rules: [
      {
        test: /.+?\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "@graphitation/embedded-document-artefact-loader/webpack",
          },
        ],
      },
    ],
  },
};
```

If you are using the `artifactDirectory` option in your relay config you will need to direct the loader to the same folder.

```js
const webpackConfig = {
  module: {
    rules: [
      {
        test: /.+?\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "@graphitation/embedded-document-artefact-loader/webpack",
            options: {
              artifactDirectory: "path/to/your/artifact/directory",
            },
          },
        ],
      },
    ],
  },
};
```

## Jest

The jest loader wraps ts-jest because there's no built-in way to chain loaders.
The host still needs to provide ts-jest on their own.

```js
const jestConfig = {
  transform: {
    "^.+\\.tsx?$": "@graphitation/embedded-document-artefact-loader/ts-jest",
  },
};
```

## TODO

- SourceMap support needs to be finished
