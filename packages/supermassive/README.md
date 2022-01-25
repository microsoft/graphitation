# @graphitation/supermassive

_[Pack more performance into smaller space](https://en.wikipedia.org/wiki/Supermassive_black_hole)_

Supermassive is a lightweight schema-less GraphQL executor and query build-time compiler.

## What

Supermassive's goals are to provide a solution with the following optimizations for when all GraphQL operations (queries, mutations, subscriptions) needed by the user-experiences are statically known at build-time:

- Bundle size of production targets needs to be as small as possible.
- Performance is favored over runtime validation.

Such is the case in our scenarios, where our schema lives entirely in the client application and some of these applications have very little to no GraphQL needs [yet] other than to suffice the needs of a single or few components.

## Why

Running a GraphQL executor can be an expensive exercise. The JavaScript community has the good fortune of having the official reference implementation of the GraphQL specification being implemented in JavaScript, namely [graphql-js](http://github.com/graphql/graphql-js). Inevitably this means that most general purpose GraphQL libraries in the JavaScript ecosystem end up wrapping it or otherwise rely on it. However, graphql-js' goal is specifically to be an _all-encompassing_ implementation used for reference needs, _not_ to be an optimized solution for specific use-cases.

## How

Consider a GraphQL schema. It is typically a sizeable chunk of data, both in terms of type/field definition metadata as well as associated field-resolvers and _their_ code dependencies. Statically knowing all GraphQL operations allows us to reduce the bundle size to a minimum by [tree-shaking](https://en.wikipedia.org/wiki/Tree_shaking) all the definition metadata not required by any of the given operations. A JavaScript code bundler can in turn ensure only that code which is needed by the remaining field-resolvers is included in the production bundle. This means that the process is entirely dependency driven by needs expressed by the user-experiences, rather than requiring blunt manual configuration.

Similarly, the GraphQL operations themselves, described using e.g. [GraphQL SDL](https://graphql.org/learn/schema/) or [`graphql-js` AST](https://github.com/graphql/graphql-js/blob/main/src/language/ast.ts), can incur quite some overhead as operations and number of operations grow. Eliminating these from the bundles can save size as well as runtime processing.

## Roadmap

### Phase 1

In this initial phase, we will achieve the goal of tree-shaking the schema definitions. We do this by inlining required metadata into the documents that describe the operations, after which they can be executed with the need of the entire schema. This means overall bundle size will be decreased when only a subset of the schema is actually used, which pays off significantly when a host application introduces its first component(s) leveraging GraphQL.

Consider a GraphQL operation like the following:

```graphql
query CurrentUserNameQuery {
  me {
    name
  }
}
```

This would lead to the following [conceptual] tree-shaking after compilation of the schema:

```diff
 type Query {
   me: User!
 }

 type User {
   name: String!
-  presence: Presence!
 }

-type Presence {
-  availability: PresenceAvailability!
-}
-
-enum PresenceAvailability {
-  AVAILABLE
-  BUSY
-  OFFLINE
-}
```

...and the field-resolver map:

```diff
 import { getUser } from "user-service";
-import { getUserPresence } from "presence-service";

 const resolvers = {
   Query: {
     me: async (_source, _args, context) => getUser(context.currentUserId),
   },
   User: {
     name: (source) => source.name,
-    presence: async (source) => getUserPresence(source.id),
   },
 };
```

### Phase 2

In this phase, we will expand on the previous phase by ahead-of-time compiling the resolution of the operations, their field-resolvers, and invocation thereof into JavaScript code. This essentially does away with any need for AST of the operation during execution. This means execution will be faster as no more generic lookups and checks need to be performed.

Consider the GraphQL operation shown in the previous phase, typical generic execution (as [described in the specification](https://spec.graphql.org/June2018/#sec-Execution)) would look something like the following recursive pseudo-code:

```ts
function visitSelectionSet(parentType, selectionSet, parentSource) {
  const result = {};
  for (const selection of selectionSet.selections) {
    switch (selection.kind) {
      case "Field": {
        const type = getType(selection.type.name);
        if (isScalarType(type)) {
          result[selection.name] = parentType.invokeFieldResolver(
            selection.name,
            parentSource,
          );
        } else if (isObjectType(type)) {
          const source = parentType.invokeFieldResolver(
            selection.name,
            parentSource,
          );
          result[selection.name] = visitSelectionSet(
            type,
            selection.selectionSet,
            source,
          );
        } else {
          // ...
        }
      }
      // ...
    }
  }
  return result;
}

function execute(query, rootSource = {}) {
  return visitSelectionSet(getType("Query"), query.selectionSet, rootSource);
}

execute(
  parse(`
    query CurrentUserNameQuery {
      me {
        name
      }
    }
  `),
);
```

Whereas a compiled version of the specific operation would look something like the following:

```ts
function CurrentUserNameQuery(rootSource = {}) {
  const meSource = QueryType.fieldResolvers["me"](rootSource);
  const result = {
    me: {
      name: UserType.fieldResolvers["name"](meSource),
    },
  };
  return result;
}

CurrentUserNameQuery();
```

### Phase 3

In this final phase, we will make it possible to replace the operations at runtime using a simple identifier, thus allowing GraphQL clients to execute their operations using these identifiers that they obtain through a concept known as ["persisted queries"](https://relay.dev/docs/guides/persisted-queries/). This means that GraphQL clients that do not require graphql-js AST _themselves_ to operate, such as Relay, will be able to greatly reduce the size of the User-Experience bundles by entirely eliminating the document in favour of a short identifier.

Again, considering the above GraphQL operation, a React component needing that data would include the GraphQL document in its bundle and look something like the following:

```tsx
function CurrentUser() {
  const data = useQuery({
    document: `
      query CurrentUserNameQuery {
        me {
          name
        }
      }
    `,
  });
  return <div>User: {data.me.name}</div>;
}
```

However, now that we can compile the operation to code ahead-of-time, and no longer need the operation AST during execution, we can eliminate the document entirely and compile the component to refer to the compiled version of the document instead:

```tsx
function CurrentUser() {
  const data = useQuery({
    persistedDocumentId: "CurrentUserNameQuery",
  });
  return <div>User: {data.me.name}</div>;
}
```

## Usage

There are 3 main parts of Supermassive - the executor, query annotator and implicit resolver extractor. Executor is the part that actually runs the queries. It takes resolvers object instead of schema and annotated documents instead of normal documents. Query annotator processes query to include type information inside them. It can be ran as part of query extraction stage in Relay Compiler or eg in `@graphitation/graphql-js-tag`. Implicit resolver extractor writes out resolvers for types that are only implicitly defined in GraphQL SDL, like Unions or Input Objects. It generates typescript file with extracted object that can be merged with the rest of the resolvers.

### Executor

Two functions are provided - `executeWithSchema` and `executeWithoutSchema`. They attempt to match `graphql-js`'s `execute` function parameters. `executeWithSchema` fully matches it and is meant for development or testing. It does the transform and resolver extraction in runtime. `executeWithoutSchema` relies on those being done during compile/bundling time.

```graphql
interface CommonExecutionArgs {
  resolvers: Resolvers;
  rootValue?: unknown;
  contextValue?: unknown;
  variableValues?: Maybe<{ [variable: string]: unknown }>;
  operationName?: Maybe<string>;
  fieldResolver?: Maybe<FieldResolver<any, any>>;
  typeResolver?: Maybe<TypeResolver<any, any>>;
}
type ExecutionWithoutSchemaArgs = CommonExecutionArgs & {
  document: DocumentNode;
};

type ExecutionWithSchemaArgs = CommonExecutionArgs & {
  document: UntypedDocumentNode;
  typeDefs: UntypedDocumentNode;
};

function executeWithoutSchema(args: ExecutionWithoutSchemaArgs): PromiseOrValue<ExecutionResult>

function executeWithSchema(args: ExecutionWithSchemaArgs): PromiseOrValue<ExecutionResult>
```

### Transform

`addTypesToRequestDocument` converts untyped graphql-js AST node into a Supermassive typed one.

```js
function addTypesToRequestDocument(
  schema: GraphQLSchema,
  document: TypelessAST.DocumentNode
): TypedAST.DocumentNode
```

With `@graphitation/graphql-js-tag` and `@graphitation/ts-transform-graphql-js-tag` (in webpack config)

```js
import { buildASTSchema } from 'graphql'
import { getTransformer } from "@graphitation/ts-transform-graphql-js-tag";
import { annotateDocumentGraphQLTransform } from "@graphitation/supermassive";

// ...

{
  test: /\.tsx?$/,
  loader: "ts-loader",
  options: {
    getCustomTransformers: () => ({
       before: [
          getTransformer({
            graphqlTagModuleExport: "graphql",
            transformer: annotateDocumentGraphQLTransform(
              buildASTSchema({
                fs.readFileSync(
                  "PATH_TO_SCHEMA_TYPEDEFS.graphql",
                  { encoding: "utf-8" }
                ),
              )
            ),
          }),
        ],
      }),
    },
  },
}
```

### Resolver extractor

Supermassive provides a bin command to extract implicit resolvers.

```sh
supermassive extract-schema PATH_TO_TYPEDEFS.graphql
```

It generates `__generated__/NAME_OF_TYPEDEFS.ts` file, on top of which user provided resolvers can be merged when executing.
