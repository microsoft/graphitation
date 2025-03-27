import type { PluginFunction } from "@graphql-codegen/plugin-helpers";
import { isScalarType } from "graphql";
import type { GraphQLSchema } from "graphql";
import { pascalCase } from "change-case-all";

const graphqlCodegenTypeMapPlugin: PluginFunction = (
  schema: GraphQLSchema,
): string => {
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
              ? `Scalars["${typeName}"]["output"]`
              : typeName
                  .split("_")
                  .map((part) => pascalCase(part))
                  .join("_")
          };`,
      ),
    "};\n",
  ].join("\n");
};

export { graphqlCodegenTypeMapPlugin as plugin };
