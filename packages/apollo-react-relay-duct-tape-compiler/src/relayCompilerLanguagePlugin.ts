import type { PluginInitializer } from "relay-compiler/lib/language/RelayLanguagePluginInterface";
import typescriptPluginInitializer from "relay-compiler-language-typescript";

import { find as findGraphQLTags } from "./findGraphQLTags";
import { formatModuleFactory } from "./formatModule";
import { generateFactory } from "./typeGenerator";
import type { FormatModuleOptions } from "./formatModule";

export function pluginFactory(
  formatModuleOptions: FormatModuleOptions,
): PluginInitializer {
  return () => {
    const typescriptPlugin = typescriptPluginInitializer();
    return {
      ...typescriptPlugin,
      findGraphQLTags,
      formatModule: formatModuleFactory(formatModuleOptions),
      typeGenerator: {
        ...typescriptPlugin.typeGenerator,
        generate: generateFactory(typescriptPlugin.typeGenerator.generate),
      },
    };
  };
}
