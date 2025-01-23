# @graphitation/ts-codegen

This package generates Typescript definitions based on GraphQL Schema Definition Language.

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
