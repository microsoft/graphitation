import {
  executeSync,
  getNamedType,
  getOperationAST,
  isAbstractType,
  isCompositeType,
  isListType,
  isScalarType,
  visit,
  DocumentNode,
  GraphQLResolveInfo,
  GraphQLSchema,
  GraphQLAbstractType,
  GraphQLCompositeType,
  GraphQLNamedType,
  GraphQLScalarType,
  FieldNode,
  FragmentDefinitionNode,
  SelectionNode,
  SelectionSetNode,
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

interface InternalMockData extends MockData {
  __abstractType?: GraphQLAbstractType;
}

const TYPENAME_KEY = "__typename";

export function generate(
  operation: OperationDescriptor,
  mockResolvers: MockResolvers | null = DEFAULT_MOCK_RESOLVERS,
): { data: MockData } {
  mockResolvers = { ...DEFAULT_MOCK_RESOLVERS, ...mockResolvers };
  const resolveValue = createValueResolver(mockResolvers);

  // RelayMockPayloadGenerator will execute documents that have optional
  // boolean variables that are not passed by the user, but are required
  // inside the document for @include/@skip to work. We rewrite the
  // document to replace these variable references with hardcoded values.
  //
  // TODO: Is this a bug in RelayMockPayloadGenerator?
  const undefinedBooleanVariables: string[] = [];
  getOperationAST(operation.request.node)!.variableDefinitions?.forEach(
    (variableDefinition) => {
      if (
        variableDefinition.type.kind === "NamedType" &&
        variableDefinition.type.name.value === "Boolean" &&
        operation.request.variables[variableDefinition.variable.name.value] ===
          undefined
      ) {
        undefinedBooleanVariables.push(variableDefinition.variable.name.value);
      }
    },
  );

  const document =
    undefinedBooleanVariables.length === 0
      ? operation.request.node
      : rewriteConditionals(operation.request.node, undefinedBooleanVariables);

  const result = executeSync({
    schema: operation.schema,
    document: document,
    variableValues: operation.request.variables,
    fieldResolver: (source: InternalMockData, args, _context, info) => {
      // FIXME: This should not assume a single selection
      const fieldNode: FieldNode = info.fieldNodes[0];
      const selectionName = fieldNode.alias?.value ?? fieldNode.name.value;
      const namedReturnType = getNamedType(info.returnType);

      if (isCompositeType(namedReturnType)) {
        const result: InternalMockData = {
          ...getDefaultValues(
            mockResolvers,
            namedReturnType,
            resolveValue,
            fieldNode,
            info,
            args,
          ),
        };
        if (isAbstractType(namedReturnType) && !result[TYPENAME_KEY]) {
          const possibleTypeNames = info.fieldNodes.reduce<string[]>(
            (acc, fieldNode) => [
              ...acc,
              ...getPossibleConcreteTypeNamesFromAbstractTypeSelections(
                operation.schema,
                fieldNode.selectionSet!,
                info.fragments,
              ),
            ],
            [],
          );
          invariant(
            possibleTypeNames?.length,
            "Expected fragment spreads on abstract type %s",
            namedReturnType.name,
          );
          result.__typename = possibleTypeNames[0];
          result.__abstractType = namedReturnType;
        }
        return result;
      } else if (isScalarType(namedReturnType)) {
        if (source[selectionName]) {
          return source[selectionName];
        }
        const result = mockScalar(
          fieldNode,
          args,
          namedReturnType,
          source.__abstractType || info.parentType,
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
  invariant(
    defaultValues === undefined || typeof defaultValues === "object",
    "Expected mock resolver to return an object",
  );
  return defaultValues;
}

function getPossibleConcreteTypeNamesFromAbstractTypeSelections(
  schema: GraphQLSchema,
  selectionSet: SelectionSetNode,
  fragments: { [key: string]: FragmentDefinitionNode },
) {
  const result: string[] = [];
  selectionSet.selections.forEach((selection) => {
    const fragmentDefinition = getFragmentSelection(selection, fragments);
    if (fragmentDefinition) {
      const typeName = fragmentDefinition.typeCondition?.name.value;
      if (
        // If undefined, it means the selection is an inline fragment on the
        // current type; i.e. on an abstract type.
        typeName === undefined ||
        isAbstractType(schema.getType(typeName))
      ) {
        result.push(
          ...getPossibleConcreteTypeNamesFromAbstractTypeSelections(
            schema,
            fragmentDefinition.selectionSet,
            fragments,
          ),
        );
      } else {
        result.push(typeName);
      }
    }
  });
  return result;
}

function getFragmentSelection(
  selection: SelectionNode,
  fragments: { [key: string]: FragmentDefinitionNode },
) {
  if (selection.kind === "FragmentSpread") {
    const fragmentDoc = fragments[selection.name.value];
    invariant(
      fragmentDoc,
      "Expected a fragment with name %s to exist",
      selection.name.value,
    );
    return fragmentDoc;
  } else if (selection.kind === "InlineFragment") {
    return selection;
  }
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

function rewriteConditionals(
  document: DocumentNode,
  undefinedBooleanVariables: string[],
) {
  return visit(document, {
    Directive(node) {
      // Default value for @include is set to false
      if (
        node.name.value === "include" &&
        node.arguments?.[0].value.kind === "Variable" &&
        undefinedBooleanVariables.includes(node.arguments[0].value.name.value)
      ) {
        return {
          ...node,
          arguments: [
            {
              ...node.arguments[0],
              value: {
                kind: "BooleanValue",
                value: false,
              },
            },
          ],
        };
      }
      // Default value for @skip is set to true
      if (
        node.name.value === "skip" &&
        node.arguments?.[0].value.kind === "Variable" &&
        undefinedBooleanVariables.includes(node.arguments[0].value.name.value)
      ) {
        return {
          ...node,
          arguments: [
            {
              ...node.arguments[0],
              value: {
                kind: "BooleanValue",
                value: true,
              },
            },
          ],
        };
      }
    },
  });
}
