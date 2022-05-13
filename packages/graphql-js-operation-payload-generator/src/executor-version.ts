import {
  executeSync,
  getNamedType,
  isAbstractType,
  isCompositeType,
  isListType,
  isScalarType,
  DocumentNode,
  GraphQLResolveInfo,
  GraphQLSchema,
  GraphQLCompositeType,
  GraphQLNamedType,
  GraphQLScalarType,
  FieldNode,
  FragmentDefinitionNode,
} from "graphql";
import { pathToArray } from "graphql/jsutils/Path";
import {
  createValueResolver,
  DEFAULT_MOCK_RESOLVERS,
  DEFAULT_MOCK_TYPENAME,
  MockData,
  MockResolverContext,
  MockResolvers,
  ValueResolver,
} from "./vendor/RelayMockPayloadGenerator";
import invariant from "invariant";

export { MockResolvers } from "./vendor/RelayMockPayloadGenerator";

export interface RequestDescriptor<Node = DocumentNode> {
  readonly node: Node;
  readonly variables: Record<string, any>;
}

export interface OperationDescriptor<
  Schema = GraphQLSchema,
  Node = DocumentNode
> {
  readonly schema: Schema;
  readonly request: RequestDescriptor<Node>;
}

const TYPENAME_KEY = "__typename";

export function generate(
  operation: OperationDescriptor,
  mockResolvers: MockResolvers | null = DEFAULT_MOCK_RESOLVERS,
): { data: MockData } {
  mockResolvers = { ...DEFAULT_MOCK_RESOLVERS, ...mockResolvers };
  const resolveValue = createValueResolver(mockResolvers);

  const result = executeSync({
    schema: operation.schema,
    document: operation.request.node,
    variableValues: operation.request.variables,
    fieldResolver: (source, args, _context, info) => {
      // FIXME: This should not assume a single selection
      const fieldNode: FieldNode = info.fieldNodes[0];
      const selectionName = fieldNode.alias?.value ?? fieldNode.name.value;
      const namedReturnType = getNamedType(info.returnType);

      if (isCompositeType(namedReturnType)) {
        let result: MockData = {};

        const defaultValues = getDefaultValues(
          mockResolvers,
          namedReturnType,
          resolveValue,
          fieldNode,
          info,
          args,
        );
        result = { ...result, ...defaultValues };

        if (isAbstractType(namedReturnType) && !result[TYPENAME_KEY]) {
          const possibleTypeNames = getPossibleTypeNamesFromAbstractTypeSelections(
            fieldNode,
            info.fragments,
          );
          invariant(
            possibleTypeNames?.length,
            "Expected fragment spreads on abstract type %s",
            namedReturnType.name,
          );
          result.__typename = possibleTypeNames[0];
        }
        return result;
      } else if (isScalarType(namedReturnType)) {
        if (source[selectionName]) {
          return source[selectionName];
        }
        const result = mockScalar(
          info.fieldNodes[0],
          args,
          namedReturnType,
          info.parentType,
          resolveValue,
        );
        return result;
      } else {
        return null;
      }
    },
  });
  if (!result || !result.data) {
    throw new Error("Expected to generate a payload");
  }
  return result as { data: MockData };
}

function getDefaultValues(
  mockResolvers: MockResolvers | null,
  namedType: GraphQLNamedType,
  resolveValue: ValueResolver,
  fieldNode: FieldNode,
  info: GraphQLResolveInfo,
  args: { [argName: string]: any },
) {
  const defaultValues =
    mockResolvers![namedType.name] &&
    (resolveValue(
      namedType.name,
      {
        name: fieldNode.name.value,
        alias: fieldNode.alias?.value,
        path: pathToArray(info.path).map((x) => x.toString()),
        args: args,
      },
      isListType(info.returnType),
    ) as MockData | undefined);
  if (defaultValues && typeof defaultValues !== "object") {
    throw new Error("Expected object!");
  }
  return defaultValues;
}

function getPossibleTypeNamesFromAbstractTypeSelections(
  fieldNode: FieldNode,
  fragments: { [key: string]: FragmentDefinitionNode },
) {
  const possibleTypeNames = fieldNode.selectionSet?.selections
    .map((fragment) => {
      if (fragment.kind === "FragmentSpread") {
        const fragmentDoc = fragments[fragment.name.value];
        invariant(
          fragmentDoc,
          "Expected a fragment with name %s to exist",
          fragment.name.value,
        );
        return fragmentDoc.typeCondition.name.value;
      } else if (fragment.kind === "InlineFragment") {
        return fragment.typeCondition?.name.value;
      }
      return undefined;
    })
    .filter(isString);
  return possibleTypeNames;
}

function isString(x: any): x is string {
  return typeof x === "string";
}

function mockScalar(
  fieldNode: FieldNode,
  args: { [argName: string]: any },
  type: GraphQLScalarType,
  parentType: GraphQLCompositeType,
  resolveValue: ValueResolver,
) {
  if (fieldNode.name.value === TYPENAME_KEY) {
    return isAbstractType(parentType) ? DEFAULT_MOCK_TYPENAME : parentType.name;
  }
  const context: MockResolverContext = {
    name: fieldNode.name.value,
    alias: fieldNode.alias?.value,
    args,
    parentType: isAbstractType(parentType)
      ? DEFAULT_MOCK_TYPENAME
      : parentType.name,
  };
  return resolveValue(type.name, context, false, undefined);
}
