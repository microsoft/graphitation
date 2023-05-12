import type { PluginInitializer } from "relay-compiler/lib/language/RelayLanguagePluginInterface";
import typescriptPluginInitializer from "relay-compiler-language-typescript";

import { findGraphQLTagsFactory } from "./findGraphQLTags";
import { formatModuleFactory } from "./formatModule";
import { generateFactory } from "./typeGenerator";
import type { FormatModuleOptions } from "./formatModule";

export async function pluginFactory(
  formatModuleOptions: FormatModuleOptions,
): Promise<PluginInitializer> {
  const formatModule = await formatModuleFactory(formatModuleOptions);
  return () => {
    const typescriptPlugin = typescriptPluginInitializer();
    return {
      ...typescriptPlugin,
      findGraphQLTags: findGraphQLTagsFactory(
        !formatModuleOptions.emitDocuments,
      ),
      formatModule,
      typeGenerator: {
        ...typescriptPlugin.typeGenerator,
        generate: generateFactory(typescriptPlugin.typeGenerator.generate),
      },
    };
  };
}
