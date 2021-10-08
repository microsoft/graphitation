import type { PluginInitializer } from "relay-compiler/lib/language/RelayLanguagePluginInterface";
import typescriptPluginInitializer from "relay-compiler-language-typescript";

import { find as findGraphQLTags } from "./findGraphQLTags";
import { formatModule } from "./formatModule";
import { generateFactory } from "./typeGenerator";

// TODO: Ideally this would be done from here, but this module is either loaded too late
//       or it's mutating the individual modules and the cli bin being used is the bundled
//       relay-compiler bin file.
//
// import { IRTransforms } from "relay-compiler";
// import { enableNodeWatchQueryTransform } from "./enableNodeWatchQueryTransform";
// IRTransforms.commonTransforms.unshift(enableNodeWatchQueryTransform);

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
