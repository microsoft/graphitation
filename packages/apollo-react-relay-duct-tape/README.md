# apollo-react-relay-duct-tape

A compatibility wrapper that provides the react-relay API on top of Apollo Client.

_The name is a reference to the Apollo 13 mission._

Use this together with [relay-compiler-language-graphitation](../relay-compiler-language-graphitation) to have typings generated.

# Setup

### Installation

- Install the packages from this repo:

  ```
  yarn add @graphitation/apollo-react-relay-duct-tape
  yarn add --dev relay-compiler-language-graphitation
  ```

- Patch your version of `@apollo/client` using the patch found in [the patches directory](../../patches). You can either do so manually or use a tool like [patch-package](https://github.com/ds300/patch-package).

- For an expedient developer-experience, you will want to install [the `watchman` tool](https://facebook.github.io/watchman/).
  - On macOS (using [homebrew](https://brew.sh)): `$ brew install watchman`
  - On Windows (using [chocolatey](https://chocolatey.org)): `$ choco install watchman`

### Configuration

- Configure Apollo Client's cache to automatically add `__typename` field selections, which concrete types implement the `Node` interface, and the type-policies needed to read the watch query data from the store:

  ```ts
  import { InMemoryCache } from "@apollo/client";
  import { typePolicies } from "@graphitation/apollo-react-relay-duct-tape";

  const cache = new InMemoryCache({
    addTypename: true,
    // Be sure to specify types that implement the Node interface
    // See https://www.apollographql.com/docs/react/data/fragments/#using-fragments-with-unions-and-interfaces
    possibleTypes: {
      Node: ["Todo"],
    },
    // Either use the `typePolicies` object directly or otherwise extend appropriately
    typePolicies: {
      Query: {
        fields: {
          node: {
            read: typePolicies.Query.fields.node.read,
          },
        },
      },
      Node: {
        fields: {
          __fragments: {
            read: typePolicies.Node.fields.__fragments.read,
          },
        },
      },
    },
  });
  ```

- Configure webpack to transform your code by replacing inline GraphQL documents with their compiled artefacts:

  ```ts
  const {
    createImportDocumentsTransform,
  } = require("@graphitation/apollo-react-relay-duct-tape/lib/storeObservation/createImportDocumentsTransform");

  const config: webpack.Configuration = {
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loader: "ts-loader",
          exclude: /node_modules/,
          options: {
            getCustomTransformers: () => ({
              before: [createImportDocumentsTransform()],
            }),
          },
        },
      ],
    },
  };
  ```

- TODO: Have a `Node` interface definition
- TODO: Add `node` root field

- Optionally, if you rely on Apollo Client's `@client` directive, be sure to explicitly add it to your local copy of your schema, otherwise the compiler will not accept its use.

  ```graphql
  directive @client(always: Boolean) on FIELD
  ```

## Usage

### Build

In a shell, start the compiler and point it to your schema and source. Depending on the size of the code-base a first run may take a while, but subsequent builds should cached. For developer-expedience, it is advised to run the compiler using the watch mode -- provided you have installed the `watchman` tool.

```
$ yarn graphitation-compiler          \
    --schema ./path/to/schema.graphql \
    --src ./path/to/source            \
    --watch
```

TODO:

- Add `Node` interface to type that you want to start a new watch query for
- Restart compiler

### Runtime

TODO:

- Add query hook
- Add fragment hook
- Import and use typings
