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

## Implementation details and plans

### Current

Starting with version 3.0, supermassive expects a compact fragment of the schema alongside documents that are sent to it.
It doesn't require having a full schema, only a small fragment necessary for a specific operation.

Schema fragment format is much more compact than the graphql-js AST. It is optimized for fast merging and serializing,
so you can incrementally load and merge schema fragments as different operations are requested.

Different strategies of "fragmentizing" the schema are possible, it is up to your specific case which strategy to choose.
Below you can find some strategies that we found useful.

#### 1. Schema fragment by operation

We can extract schema fragments by running a pre-processing step on queries, in the same stage where `graphql` tags would normally be extracted and pre-parsed.
Supermassive package contains several handy utilities for this strategy.

#### 2. Schema modules

If the schema is big enough, it is a common practice to split it into [multiple modules](https://the-guild.dev/graphql/modules/docs).
In this case the natural strategy is to generate a single fragment per module. Supermassive supports custom fragment loader,
so when an operation contains an unknown field or type, supermassive will request a fragment for it.
This strategy implies "schema map" to properly map operations or individual types to appropriate schema modules
(schema map generation is out of scope for supermassive itself).

#### 3. Variation of the two

Other strategies usually represent a variation of those two. E.g. a fragment per specific group of operations, group of modules,
or mix of modules and operations. Supermassive is agnostic to your "fragmentizing" strategy.

### Possible future - pre-normalized executor

In a scenario where executor is running close to the client (sometimes even in same process or at least in same browser), it might be worth exploring removing some of the requirements imposed by the usual GraphQL transport - for example serialization. Not only GraphQL executors do the JSON serialization, but also they return the data that is optimized for transport and that matches the query tree. This means clients need to perform often expensive normazilation. As traffic and message size might be less important in same process / same browser scenarios, it might be worthwhile exploring return pre-normalized data from supermassive. This offers massive speedups for some clients like Apollo ([see benchmarks](https://github.com/vladar/graphql-normalized)).

### Possible future - Tree-shaking based on documents

Current implementation is more efficient in terms of bundles than one requiring full schema, but resolvers are also not always needed. By going through fields being selected in the documents, resolvers can be split or tree-shook to only load ones that are required for certain frontend bundle.

Consider a GraphQL operation like the following:

```graphql
query CurrentUserNameQuery {
  me {
    name
  }
}
```

This would lead to the following [conceptual] tree-shaking after compilation of the field-resolver map:

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

### Possible future - GraphQL-to-JS

We can expand on the previous phase by ahead-of-time compiling the resolution of the operations, their field-resolvers, and invocation thereof into JavaScript code. This essentially does away with any need for AST of the operation during execution. This means execution will be faster as no more generic lookups and checks need to be performed.

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

### Possible future - persisted queries

we can make it possible to replace the operations at runtime using a simple identifier, thus allowing GraphQL clients to execute their operations using these identifiers that they obtain through a concept known as ["persisted queries"](https://relay.dev/docs/guides/persisted-queries/). This means that GraphQL clients that do not require graphql-js AST _themselves_ to operate, such as Relay, will be able to greatly reduce the size of the User-Experience bundles by entirely eliminating the document in favour of a short identifier.

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

There are 3 main parts of Supermassive:

1. The executor
2. Minimal viable schema fragment extractor and query annotator (for [schema fragment by operation](#1-schema-fragment-by-operation) strategy)
3. Schema fragment encoder from/to graphql-js AST (for [schema modules](#2-schema-modules) strategy) + utilities for fragment merging

Executor is the part that actually runs the queries. It takes operation document and schema fragment (composed of resolvers and compact type definitions) and optionally, schema fragment loader.

Schema fragment extractor process query to extract type definitions necessary to execute this query.
Query annotator could be used to inline those type definitions into query itself (e.g. as a directive).
Annotator can be run as part of query extraction stage in Relay Compiler or eg in `@graphitation/graphql-js-tag`.

Schema fragment encoder is necessary to produce schema fragments based on [schema modules](#2-schema-modules).
It takes graphql-js AST of the individual schema module and converts it to the compact schema fragment format.

### Executor

Two functions are provided - `executeWithSchema` and `executeWithoutSchema`. They attempt to match `graphql-js`'s `execute` function parameters. `executeWithSchema` fully matches it and is meant for development or testing. It does the schema fragment extraction for operation in runtime. `executeWithoutSchema` expects schema fragment extracted at build/compile-time, as a required argument.

```ts
interface CommonExecutionArgs {
  document: DocumentNode;
  rootValue?: unknown;
  contextValue?: unknown;
  variableValues?: Maybe<{ [variable: string]: unknown }>;
  operationName?: Maybe<string>;
  fieldResolver?: Maybe<FieldResolver<any, any>>;
  typeResolver?: Maybe<TypeResolver<any, any>>;
}
type ExecutionWithoutSchemaArgs = CommonExecutionArgs & {
  schemaFragment: SchemaFragment;
  schemaFragmentLoader?: SchemaFragmentLoader;
};

type ExecutionWithSchemaArgs = CommonExecutionArgs & {
  definitions: DocumentNode;
  resolvers: UserResolvers;
};

function executeWithoutSchema(
  args: ExecutionWithoutSchemaArgs,
): PromiseOrValue<ExecutionResult>;

function executeWithSchema(
  args: ExecutionWithSchemaArgs,
): PromiseOrValue<ExecutionResult>;
```

### Minimal viable schema extractor

Extracts minimal schema fragment necessary for operation execution with supermassive.

```ts
export function extractMinimalViableSchemaForRequestDocument(
  schema: GraphQLSchema,
  requestDocument: DocumentNode,
): { definitions: SchemaDefinitions; unknownDirectives: DirectiveNode[] };
```

### Webpack Transform

Inlines schema definitions extracted with `extractMinimalViableSchemaForRequestDocument` into the `@schema` directive of each operation / fragment node.

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

### Schema definitions encoder

Encodes SDL type definitions represented by graphql-js AST to compact format, necessary for execution with supermassive.

```ts
export function encodeASTSchema(
  schemaFragment: DocumentNode,
): SchemaDefinitions[];
export function decodeASTSchema(
  encodedSchemaFragments: SchemaDefinitions[],
): DocumentNode;
```

Usage example:

```js
import { prase } from "graphql";
import { encodeASTSchema, decodeASTSchema } from "@graphitation/supermassive";

const typeDefs = parse(
  fs.readFileSync("PATH_TO_SCHEMA_TYPEDEFS.graphql", { encoding: "utf-8" }),
);

const encodedTypeDefs = encodeASTSchema(typeDefs);
const decodedTypeDefs = decodeASTSchema(encodedTypeDefs); // decodedTypeDefs are same as typeDefs
```

### Utilities for definitions and resolvers merging

Utilities are useful when it is necessary to produce a single schema fragment from multiple schema fragments.

```ts
export function mergeSchemaDefinitions(
  accumulator: SchemaDefinitions,
  definitions: SchemaDefinitions[],
): SchemaDefinitions;

export function mergeResolvers(
  accumulator: Resolvers,
  resolvers: (Resolvers | Resolvers[])[],
): Resolvers;
```
