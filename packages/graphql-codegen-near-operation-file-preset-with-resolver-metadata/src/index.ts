import { Types } from "@graphql-codegen/plugin-helpers";
import { preset as nearOperationPreset } from "@graphql-codegen/near-operation-file-preset";
import path from "path";
import { Source } from "@graphql-tools/utils";
import { DocumentNode } from "graphql";
import {
  FragmentImport,
  ImportSource,
} from "@graphql-codegen/visitor-plugin-common";
import {
  getDefinitionsMetadata,
  SupportedOperations,
} from "./definitions-metadata";
import { writeFileSync } from "fs";

export type { DefinitionsMetadata } from "./definitions-metadata";

export type FragmentImportFromFn = (
  source: ImportSource<FragmentImport>,
  sourceFilePath: string,
) => ImportSource<FragmentImport>;

export type NearOperationFileConfig = {
  /**
   * @description Required, should point to the base schema types file.
   * The key of the output is used a the base path for this file.
   *
   * If you wish to use an NPM package or a local workspace package, make sure to prefix the package name with `~`.
   *
   * @exampleMarkdown
   * ```yml
   * generates:
   * src/:
   *  preset: near-operation-file
   *  presetConfig:
   *    baseTypesPath: types.ts
   *  plugins:
   *    - typescript-operations
   * ```
   */
  baseTypesPath: string;
  /**
   * @description Overrides all external fragments import types by using a specific file path or a package name.
   *
   * If you wish to use an NPM package or a local workspace package, make sure to prefix the package name with `~`.
   *
   * @exampleMarkdown
   * ```yml
   * generates:
   * src/:
   *  preset: near-operation-file
   *  presetConfig:
   *    baseTypesPath: types.ts
   *    importAllFragmentsFrom: '@fragments'
   *  plugins:
   *    - typescript-operations
   * ```
   */
  importAllFragmentsFrom?: string | FragmentImportFromFn;
  /**
   * @description Optional, sets the extension for the generated files. Use this to override the extension if you are using plugins that requires a different type of extensions (such as `typescript-react-apollo`)
   * @default .generates.ts
   *
   * @exampleMarkdown
   * ```yml
   * generates:
   * src/:
   *  preset: near-operation-file
   *  presetConfig:
   *    baseTypesPath: types.ts
   *    extension: .generated.tsx
   *  plugins:
   *    - typescript-operations
   *    - typescript-react-apollo
   * ```
   */
  extension?: string;
  /**
   * @description Optional, override the `cwd` of the execution. We are using `cwd` to figure out the imports between files. Use this if your execuion path is not your project root directory.
   * @default process.cwd()
   *
   * @exampleMarkdown
   * ```yml
   * generates:
   * src/:
   *  preset: near-operation-file
   *  presetConfig:
   *    baseTypesPath: types.ts
   *    cwd: /some/path
   *  plugins:
   *    - typescript-operations
   * ```
   */
  cwd?: string;
  /**
   * @description Optional, defines a folder, (Relative to the source files) where the generated files will be created.
   * @default ''
   *
   * @exampleMarkdown
   * ```yml
   * generates:
   * src/:
   *  preset: near-operation-file
   *  presetConfig:
   *    baseTypesPath: types.ts
   *    folder: __generated__
   *  plugins:
   *    - typescript-operations
   * ```
   */
  folder?: string;
  /**
   * @description Optional, override the name of the import namespace used to import from the `baseTypesPath` file.
   * @default Types
   *
   * @exampleMarkdown
   * ```yml
   * generates:
   * src/:
   *  preset: near-operation-file
   *  presetConfig:
   *    baseTypesPath: types.ts
   *    importTypesNamespace: SchemaTypes
   *  plugins:
   *    - typescript-operations
   * ```
   */
  importTypesNamespace?: string;
  supportedResolvers?: SupportedResolvers;
  supportedOperations?: SupportedOperations;
  sharedFragmentsDirectoryName?: string;
  usedResolversMetadataDirectoryPath?: string;
};

export type SupportedResolvers = {
  supportedResolvers?: {
    configs?: {
      value?: { [operation: string]: string[] };
    }[];
  };
};

export const preset: Types.OutputPreset<NearOperationFileConfig> = {
  buildGeneratesSection: (options) => {
    const documents: DocumentNode[] = options.documents.map(
      (documentFile: Source) => {
        if (
          !documentFile.document ||
          !documentFile.document.definitions ||
          !documentFile.location
        ) {
          throw new Error(
            `Document "${documentFile.location}" does not contain any definitions or location!`,
          );
        }

        return documentFile.document;
      },
    );

    const resolverMetadata = getDefinitionsMetadata(documents, options);
    if (
      resolverMetadata &&
      options.presetConfig.usedResolversMetadataDirectoryPath
    ) {
      const { schemaMetadata, ...definitionsMetadata } = resolverMetadata;
      writeFileSync(
        path.resolve(
          options.presetConfig.usedResolversMetadataDirectoryPath,
          "./definitions-metadata.json",
        ),
        JSON.stringify(definitionsMetadata, null, 2),
      );
      writeFileSync(
        path.resolve(
          options.presetConfig.usedResolversMetadataDirectoryPath,
          "./schema-metadata.json",
        ),
        JSON.stringify(schemaMetadata, null, 2),
      );
    }

    return nearOperationPreset.buildGeneratesSection(options);
  },
};

export default preset;
