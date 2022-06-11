import { generate } from "@graphql-codegen/cli";

generate(
  {
    schema: require.resolve("relay-test-utils-internal/lib/testschema.graphql"),
    generates: {
      "./src/__tests__/__generated__/schema-types.ts": {
        plugins: [
          "typescript",
          "@graphitation/graphql-codegen-typescript-typemap-plugin",
        ],
      },
    },
  },
  true,
);
