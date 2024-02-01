# apollo-react-relay-duct-tape

A compatibility wrapper that provides the react-relay API on top of Apollo Client.

_The name is a reference to the Apollo 13 mission._

Use this together with [@graphitation/apollo-react-relay-duct-tape-compiler](../apollo-react-relay-duct-tape-compiler) to have typings and compiled documents generated.

# Setup

### Installation

- Install the packages from this repo:

  ```
  yarn add @graphitation/apollo-react-relay-duct-tape
  yarn add --dev @graphitation/apollo-react-relay-duct-tape-compiler
  ```

- Patch your version of `@apollo/client` using the patch found in [the patches directory](../../patches). You can either do so manually or use a tool like [patch-package](https://github.com/ds300/patch-package).

- For an expedient developer-experience, you will want to install [the `watchman` tool](https://facebook.github.io/watchman/).
  - On macOS (using [homebrew](https://brew.sh)): `$ brew install watchman`
  - On Windows (using [chocolatey](https://chocolatey.org)): `$ choco install watchman`

### Configuration

TODO:

- We cannot support the default apollo cache keys for fragments on Node [derived] interfaces. Seeing as Node semantics are so core to the ability to provide these APIs, it makes sense to remove the apollo default cache key support.
- Copy apollo cache config required from the example app. This includes getting the list of possible types and the dataIdFromObject implementation.

- Configure Apollo Client's cache to automatically add `__typename` field selections, which concrete types implement the `Node` interface, and the type-policies needed to read the watch query data from the store:

  ```ts
  import { InMemoryCache } from "@apollo/client";
  import { typePoliciesWithGlobalObjectIdStoreKeys as typePolicies } from "@graphitation/apollo-react-relay-duct-tape";

  const cache = new InMemoryCache({
    addTypename: true,
    // Be sure to specify types that implement the Node interface
    // See https://www.apollographql.com/docs/react/data/fragments/#using-fragments-with-unions-and-interfaces
    possibleTypes: {
      Node: ["Todo"],
    },
    // Either use the `typePoliciesWithGlobalObjectIdStoreKeys` object directly or otherwise extend appropriately. Alternatively you can also use typePoliciesWithDefaultApolloClientStoreKeys
    typePolicies: {
      Query: {
        fields: {
          __fragments: {
            read: typePolicies.Query.fields.__fragments.read,
          },
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
    // Make sure to specify the dataIdFromObject implementation if you rely on typePoliciesWithGlobalObjectIdStoreKeys
    dataIdFromObject(responseObject, keyFieldsContext) {
      if (
        responseObject.id &&
        responseObject.__typename &&
        possibleTypes?.Node.includes(responseObject.__typename)
      ) {
        return responseObject.id as string;
      }
      // fallback to default way of doing it
      return defaultDataIdFromObject(responseObject, keyFieldsContext);
    },
  });
  ```

  In most cases as in [the example app](../../examples/apollo-watch-fragments/src/graphql.ts), you can just build the configuration using utilities exported from `@graphitation/apollo-react-relay-duct-tape`:

  ```ts
  import { InMemoryCache, defaultDataIdFromObject } from "@apollo/client";
  import { schema } from "fileWithYourSchema";
  import {
    typePoliciesWithGlobalObjectIdStoreKeys,
    getPossibleTypesAndDataIdFromNode,
  } from "@graphitation/apollo-react-relay-duct-tape";

  const { possibleTypes, dataIdFromObject } =
    getPossibleTypesAndDataIdFromNode(schema);

  const cache = new InMemoryCache({
    addTypename: true,
    possibleTypes, // already makes sure to contain all possible types for Node interface
    typePolicies: typePoliciesWithGlobalObjectIdStoreKeys,
    dataIdFromObject(responseObject, keyFieldsContext) {
      return (
        dataIdFromNode(responseObject, keyFieldsContext) ||
        defaultDataIdFromObject(responseObject, keyFieldsContext)
      );
    },
  });
  ```

- Configure webpack to transform your code by replacing inline GraphQL documents with their compiled artefacts:

  ```ts
  const config: webpack.Configuration = {
    module: {
      rules: [
        {
          test: /.+?\.tsx?$/,
          loader: "@graphitation/embedded-document-artefact-loader/webpack",
          exclude: /node_modules/,
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
$ yarn duct-tape-compiler          \
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

## Architecture

- Fragment reference variables need to be propagated to child fragment hooks, so refetch hooks can re-use original request variables.
  - This cannot be done through React Context, because a refetch hook needs to be able to [partially] update original variables, which cannot be done with React Context.
  - Instead, we pass these as React props, which are populated through GraphQL as we can know exactly where [child] fragments are being referenced and the data needs to be encoded. The actual resolving of the data is done through the (./packages/apollo-react-relay-duct-tape/src/storeObservation/fragmentReferencesFieldPolicy.ts)[fragmentReferencesFieldPolicy] Apollo Cache field policy.
  - Because we can't just add a Apollo Cache field policy to _any_ type, as we don't even know all types, we add it to the `Node` interface instead. The one other type we can assume to exist is the `Query` type.
