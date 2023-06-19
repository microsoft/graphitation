# @graphitation/supermassive-ast

AST definitions and AST transform for supermassive. Annotates a document so a supermassive can execute it without runtime schema.

## Transform

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
