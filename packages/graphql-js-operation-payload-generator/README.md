# @graphitation/graphql-js-operation-payload-generator

The `@graphitation/graphql-js-operation-payload-generator` package allows you to generate mock payloads for GraphQL operations using the `graphql-js` AST and a GraphQL schema. It provides similar functionality to [Relay's `MockPayloadGenerator`](https://relay.dev/docs/guides/testing-relay-components/#mock-payload-generator-and-the-relay_test_operation-directive) and is designed for behavior-driven testing of GraphQL components.

🤝 This package works hand-in-hand with [@graphitation/apollo-mock-client](../apollo-mock-client), to provide a complete testing experience.

📝 Be sure to read [the testing guide](https://microsoft.github.io/graphitation/docs/learn-graphql/guides/testing-components-with-graphql) for a complete picture.

## Installation

Install the package using npm:

```shell
npm install @graphitation/graphql-js-operation-payload-generator
```

or using yarn:

```shell
yarn add @graphitation/graphql-js-operation-payload-generator
```

## Usage

To generate a mock payload, follow these steps:

1. Import the necessary dependencies:

```js
import * as MockPayloadGenerator from "@graphitation/graphql-js-operation-payload-generator";
import { buildSchema } from "graphql";
```

2. Get a GraphQLSchema object instance of your schema:

```js
const schema = buildSchema(`
  type Query {
    # ...
  }
`);
```

3. Define your operation descriptor:

```js
const operation = {
  schema,
  request: {
    node: /* your GraphQL operation */,
    variables: /* your GraphQL operation variables */,
  },
};
```

The operation descriptor consists of the GraphQL schema and the request descriptor, which includes the GraphQL operation and variables.

4. Generate the mock payload using the `generate` function:

```js
const payload = MockPayloadGenerator.generate(operation, mockResolvers);
```

The `generate` function takes in the operation descriptor and optional mock resolvers to generate the mock payload for the specified operation.

## Mock Resolvers

Mock resolvers are functions that provide mock data for different GraphQL types. By default, the generator will create mock data for all fields in the request. You can define custom mock resolvers for specific types to selectively provide explicit field values for those fields that matter to your test or storybook story.

Here's an example of defining custom mock resolvers:

```js
const mockResolvers = {
  User: (context, generateId) => ({
    id: generateId(),
    name: "John Doe",
    profile_picture: {
      uri: "<mock-value-for-field-'uri'>",
      width: 42,
      height: 42,
    },
  }),
};
```

In the above example, we define a custom mock resolver for the `User` type. The resolver function receives a context object and a `generateId` function and returns the mock data for the `User` type. Only the `id`, `name`, and `profile_picture` fields are explicitly provided with values, and the rest of the fields will be generated by the default mock resolver.

## Example

Here's an example that demonstrates the usage of this package:

```js
import * as MockPayloadGenerator from "@graphitation/graphql-js-operation-payload-generator";
import { graphql } from "@graphitation/graphql-js-tag";
import { buildSchema } from "graphql";

const schema = buildSchema(`
  type Query {
    user(id: ID!): User
  }

  type User {
    id: ID!
    name: String!
    profile_picture: Image
  }

  type Image {
    uri: String!
    width: Int!
    height: Int!
  }
`);

const operation = {
  schema,
  request: {
    node: graphql`
      query SomeQuery($userId: ID!) {
        user(id: $userId) {
          id
          name
          profile_picture {
            uri
            width
            height
          }
        }
      }
    `,
    variables: { userId: "my-id" },
  },
};
```

Generate mock payload with default values:

```js
const payload = MockPayloadGenerator.generate(operation);
console.log(JSON.stringify(payload, null, 2));
```

Output:

```json
{
  "data": {
    "__typename": "Query",
    "user": {
      "__typename": "User",
      "id": "<mock-id-2>",
      "name": "<mock-value-for-field-'name'>",
      "profile_picture": {
        "__typename": "Image",
        "uri": "<mock-value-for-field-'uri'>",
        "width": 42,
        "height": 42
      }
    }
  }
}
```

Generate mock payload with explicit user name:

```js
const mockResolvers = {
  User: (context, generateId) => ({
    id: generateId(),
    name: "John Doe",
    profile_picture: {
      uri: "<mock-value-for-field-'uri'>",
      width: 42,
      height: 42,
    },
  }),
};

const payload = MockPayloadGenerator.generate(
  operation,
  mockResolvers
);
```

Output:

```diff
 {
   "data": {
     "__typename": "Query",
     "user": {
       "__typename": "User",
       "id": "<mock-id-2>",
-      "name": "<mock-value-for-field-'name'>",
+      "name": "John Doe",
       "profile_picture": {
         "__typename": "Image",
         "uri": "<mock-value-for-field-'uri'>",
         "width": 42,
         "height": 42
       }
     }
   }
 }
```

## Schema Type-Checking and Auto-Completion

If you want type-checking and auto-completion support for the mock resolvers, you can provide a type map using the generate function. The type map consists of type names as keys and the corresponding GraphQL types as values.

For example, if you are using @graphql-code-generator, you can emit the type map using the [@graphitation/graphql-codegen-typescript-typemap-plugin](../graphql-codegen-typescript-typemap-plugin) plugin. This plugin generates TypeScript type definitions based on your GraphQL schema and can include the type map.

Here's an example configuration in codegen.yml:

```yml
Copy code
schema: http://localhost:3000/graphql
generates:
  ./src/types.ts:
    plugins:
      - typescript
      - @graphitation/graphql-codegen-typescript-typemap-plugin
    config:
      allowEnumStringTypes: true
```

By providing the type map, you can benefit from improved type safety and editor support when working with the generated mock payloads.

That's it! You can now generate mock payloads for your GraphQL operations using `@graphitation/graphql-js-operation-payload-generator`. Use these mock payloads in your tests to ensure your GraphQL components behave as expected in different scenarios.
