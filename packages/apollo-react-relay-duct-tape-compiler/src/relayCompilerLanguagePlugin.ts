import type { PluginInitializer } from "relay-compiler/lib/language/RelayLanguagePluginInterface";

import { findGraphQLTagsFactory } from "./findGraphQLTags";
import { formatModuleFactory } from "./formatModule";
import { generateFactory } from "./typeGenerator";
import type { FormatModuleOptions } from "./formatModule";
import * as TypeScriptGenerator from "./typescriptTransforms/TypeScriptGenerator";

export async function pluginFactory(
  formatModuleOptions: FormatModuleOptions,
): Promise<PluginInitializer> {
  const formatModule = await formatModuleFactory(formatModuleOptions);
  return () => {
    return {
      inputExtensions: ["ts", "tsx"],
      outputExtension: "ts",
      findGraphQLTags: findGraphQLTagsFactory(
        !formatModuleOptions.emitDocuments,
      ),
      formatModule,
      typeGenerator: {
        ...TypeScriptGenerator,
        generate: generateFactory(TypeScriptGenerator.generate),
      },
    };
  };
}
