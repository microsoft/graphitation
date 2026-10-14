# @graphitation/ts-codegen

This package generates Typescript definitions based on GraphQL Schema Definition Language.

## Schema type map

With `legacyCompat: true` (`supermassive generate-interfaces --legacy`), the
generated `legacy-types.interface.ts` also exports a `TypeMap` type alias:

```typescript
import type { TypeMap } from "./__generated__/legacy-types.interface";

type Key = TypeMap["AESKey"]; // Models.AESKey
type Id = TypeMap["ID"]; // string
type Root = TypeMap["Query"]; // Models.Query, when Query is in the input
type TypeName = keyof TypeMap; // exact GraphQL names; no string index signature
```

`TypeMap` includes the five built-in scalars, custom scalars via `Scalars`,
and the input document's objects, inputs, enums, interfaces, and unions via
their generated `Models` types. Introspection names starting with `__` are
excluded. Operation types are included only when defined or extended in the
input; legacy mode generates their model shapes, including extension fields.
Existing `Types` and `Scalars` exports remain available.

The closed type alias can be used with
`MockResolvers<TypeMap>` from
`@graphitation/graphql-js-operation-payload-generator` without a runtime
dependency or loss of key autocomplete. Model and scalar mappings respect
`modelScope`; this option selects `@model` mappings, not schema types.
An unmapped custom scalar retains the generator's `unknown` type. The map
describes this input document, not a different or composed full schema, and
does not add types from imported modules that are absent from the document.

## Parameters

- `document` (DocumentNode): The GraphQL document consisting the schema definitions to generate TypeScript code from.
- `options` (GenerateTSOptions): An object containing various options for the code generation.

### Options

Below is the list of all flags that can be passed to the code generator (see [codegen.ts](./src/codegen.ts)).

```typescript
export interface GenerateTSOptions {
  outputPath: string;
  documentPath: string;
  contextTypePath?: string | null;
  contextTypeName?: string;
  enumsImport?: string | null;
  legacyCompat?: boolean;
  useStringUnionsInsteadOfEnums?: boolean;
  legacyNoModelsForObjects?: boolean;
  modelScope?: string | null;
  generateOnlyEnums?: boolean;
  enumNamesToMigrate?: string[];
  enumNamesToKeep?: string[];
  contextSubTypeNameTemplate?: string;
  contextSubTypePathTemplate?: string;
  defaultContextSubTypePath?: string;
  defaultContextSubTypeName?: string;
  /**
   * Enable the generation of the resolver map as the default export in the resolvers file.
   *
   * @see createResolversMap in packages/ts-codegen/src/resolvers.ts
   *
   * @example
   * export default interface ResolversMap {
   *    readonly User?: User.Resolvers;
   *    readonly Post?: Post.Resolvers;
   *    readonly Query?: Query.Resolvers;
   *   }
   * */
  generateResolverMap?: boolean;
}
```
