# @graphitation/supermassive

_Pack more performance into smaller space_

Supermassive is lightweight schema-less GraphQL executor and query build-time compiler.

Running GraphQL executor on client can be expensive. Schema is a heavy object, typedefs, queries - it all can add up both in bundle size and performance. Supermassive aims to reduce that cost by removing the need to have a schema to run queries. It removes all runtime validation and accepts resolvers (like makeExecutableSchema resolvers) object. In addition it annotates GraphQL Documents to containt annotated type information. After that it proceeds to execute the queries without requiring actual schema. In future the plan is that GraphQL Documents are also eliminated and a inline functions are generated instead.

There are 3 main parts of supermassive - the executor, query annotator and implicit resolver extractor. Executor is the part that actually runs the queries. It takes resolvers object instead of schema and annotated documents instead of normal documents. Query annotator processes query to include type information inside them. It can be ran as part of query extraction stage in Relay Compiler or eg in `@graphitation/graphql-js-tag`. Implicit resolver extractor writes out resolvers for types that are only implicitly defined in GraphQL SDL, like Unions or Input Objects. It generates typescript file with extracted object that can be merged with the rest of the resolvers.

## Usage

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

`addTypesToRequestDocument` converts untyped graphql-js AST node into a supermassive typed one.

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
