import { TypeGenerator } from "relay-compiler/lib/language/RelayLanguagePluginInterface";

export function generateFactory(wrappedGenerate: TypeGenerator["generate"]) {
  const generate: TypeGenerator["generate"] = (schema, node, options) => {
    const generated = wrappedGenerate(schema, node, options);
    return (
      generated
        .replace("relay-runtime", "@graphitation/apollo-react-relay-duct-tape")
        // Align the generated types with the relay-compiler >= 15.0.0 output
        .replace(/\$fragmentRefs/g, "$fragmentSpreads")
        .replace(/\$refType/g, "$fragmentType")
        // These fields in the `@raw_response_type` output are really just for relay-runtime, so for now we can just
        // strip them out entirely.
        .replace(/^\s+readonly __is[A-Z].+;\n/gm, "")
    );
  };
  return generate;
}
