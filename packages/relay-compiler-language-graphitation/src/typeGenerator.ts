/**
 * NOTE: This is currently in-flight and mostly re-uses code from the above mentioned package, where it's tested.
 */
/* istanbul ignore file */

import { TypeGenerator } from "relay-compiler/lib/language/RelayLanguagePluginInterface";

export function generateFactory(wrappedGenerate: TypeGenerator["generate"]) {
  const generate: TypeGenerator["generate"] = (schema, node, options) => {
    const generated = wrappedGenerate(schema, node, options);
    return (
      generated
        .replace("relay-runtime", "@graphitation/apollo-react-relay-duct-tape")
        // These fields in the `@raw_response_type` output are really just for relay-runtime, so for now we can just
        // strip them out entirely.
        .replace(/^\s+readonly __is[A-Z].+;\n/gm, "")
    );
  };
  return generate;
}
