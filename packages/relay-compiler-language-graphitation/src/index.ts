import type { PluginInitializer } from "relay-compiler/lib/language/RelayLanguagePluginInterface";
import typescriptPluginInitializer from "relay-compiler-language-typescript";

import { find as findGraphQLTags } from "./findGraphQLTags";
import { formatModule } from "./formatModule";
import { generateFactory } from "./typeGenerator";

const pluginInitializer: PluginInitializer = () => {
  const typescriptPlugin = typescriptPluginInitializer();
  return {
    ...typescriptPlugin,
    findGraphQLTags,
    formatModule,
    typeGenerator: {
      ...typescriptPlugin.typeGenerator,
      generate: generateFactory(typescriptPlugin.typeGenerator.generate),
    },
  };
};

export = pluginInitializer;
