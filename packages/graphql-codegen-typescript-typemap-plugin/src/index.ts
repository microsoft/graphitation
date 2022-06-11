import type { CodegenPlugin } from "@graphql-codegen/plugin-helpers";
import { isScalarType } from "graphql";
import type { GraphQLSchema } from "graphql";
import { pascalCase } from "change-case-all";

const typeMapPlugin = (schema: GraphQLSchema): string => {
  const typesMap = schema.getTypeMap();
  return [
    "export type TypeMap = {",
    ...Object.keys(typesMap)
      .sort()
      .filter((typeName) => !typeName.startsWith("__"))
      .map(
        (typeName) =>
          `  "${typeName}": ${
            isScalarType(typesMap[typeName])
              ? `Scalars["${typeName}"]`
              : pascalCase(typeName)
          };`,
      ),
    "};\n",
  ].join("\n");
};

const config: CodegenPlugin = {
  plugin: typeMapPlugin,
};

export = config;
