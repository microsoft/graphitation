import { KeyFieldsFunction } from "@apollo/client/cache/inmemory/policies";
import { GraphQLSchema, isInterfaceType, isUnionType } from "graphql";
import invariant from "invariant";

export function getPossibleTypesAndDataIdFromNode(schema: GraphQLSchema): {
  possibleTypes: Record<string, string[]>;
  dataIdFromNode: KeyFieldsFunction;
} {
  const possibleTypes: Record<string, string[]> = {};
  const typeMap = schema.getTypeMap();
  for (const typeName in typeMap) {
    const type = typeMap[typeName];
    if (isInterfaceType(type)) {
      const implementations = schema.getImplementations(type);
      possibleTypes[typeName] = [
        ...implementations.objects,
        ...implementations.interfaces,
      ].map((x) => x.name);
    } else if (isUnionType(type)) {
      possibleTypes[typeName] = schema
        .getPossibleTypes(type)
        .map((x) => x.name);
    }
  }
  invariant(
    possibleTypes.Node,
    "Node interface and implementations thereof must be defined",
  );
  return {
    possibleTypes,
    dataIdFromNode: (object) => {
      if (
        object.id &&
        object.__typename &&
        possibleTypes.Node.includes(object.__typename)
      ) {
        return object.id as string;
      }
    },
  };
}
