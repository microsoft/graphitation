import {
  GraphQLObjectType,
  executeSync,
  getNamedType,
  getNullableType,
  getOperationAST,
  isAbstractType,
  isCompositeType,
  isEnumType,
  isListType,
  isScalarType,
  visit,
} from "graphql";
import type {
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
  DefaultMockResolvers,
  createValueResolver,
  DEFAULT_MOCK_RESOLVERS,
  DEFAULT_MOCK_TYPENAME,
} from "./vendor/RelayMockPayloadGenerator";
import type {
  MockData,
  MockResolverContext,
  MockResolvers,
  ValueResolver,
} from "./vendor/RelayMockPayloadGenerator";
import invariant from "invariant";
import deepmerge from "deepmerge";

export type { MockResolvers };

export interface RequestDescriptor<Node = DocumentNode> {
  readonly node: Node;
  readonly variables: Record<string, unknown>;
}

export interface OperationDescriptor<
  Schema = GraphQLSchema,
  Node = DocumentNode,
> {
  readonly schema: Schema;
  readonly request: RequestDescriptor<Node>;
}

interface InternalMockData extends MockData {
  __abstractType?: GraphQLAbstractType;
}

const TYPENAME_KEY = "__typename";

export function generate<TypeMap extends DefaultMockResolvers>(
  operation: OperationDescriptor,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockResolvers: MockResolvers<TypeMap> = DEFAULT_MOCK_RESOLVERS as any, // FIXME: Why does TS not accept this?
  enableDefer: undefined | false = false,
  generateId?: () => number,
): { data: MockData } {
  mockResolvers = { ...DEFAULT_MOCK_RESOLVERS, ...mockResolvers };
  const resolveValue = createValueResolver(mockResolvers, generateId);

  // RelayMockPayloadGenerator will execute documents that have optional
  // boolean variables that are not passed by the user, but are required
  // inside the document for @include/@skip to work. We rewrite the
  // document to replace these variable references with hardcoded values.
  //
  // TODO: Is this a bug in RelayMockPayloadGenerator?
  const undefinedBooleanVariables: string[] = [];
  getOperationAST(operation.request.node)?.variableDefinitions?.forEach(
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

  let document = operation.request.node;
  if (undefinedBooleanVariables.length > 0) {
    document = rewriteConditionals(document, undefinedBooleanVariables);
  }
  if (enableDefer) {
    throw new Error(
      "Enabling @defer in payload generation is not supported at this time.",
    );
  } else {
    document = removeDeferAndStream(document);
  }

  const result = executeSync({
    schema: operation.schema,
    document: document,
    variableValues: operation.request.variables,
    rootValue: mockCompositeType(
      mockResolvers,
      getRootType(operation) as GraphQLObjectType,
      null,
      resolveValue,
      null,
      null,
      {},
      operation,
    ),
    fieldResolver: (source: InternalMockData, args, _context, info) => {
      // FIXME: This should not assume a single selection
      const fieldNode: FieldNode = info.fieldNodes[0];
      const selectionName = fieldNode.alias?.value ?? fieldNode.name.value;

      // Explicit null value
      if (source[selectionName] === null) {
        return null;
      }

      const namedReturnType = getNamedType(info.returnType);
      const isList = isListType(getNullableType(info.returnType));
      if (isCompositeType(namedReturnType)) {
        // TODO: This 'is list' logic is also done by the value resolver,
        // so probably need to refactor this code to actually leverage that.
        const generateValue = (userValue?: { __typename?: string }) => {
          // Explicit null value
          if (userValue === null) {
            return null;
          }
          const result = {
            ...mockCompositeType(
              mockResolvers,
              namedReturnType,
              userValue?.[TYPENAME_KEY] || null,
              resolveValue,
              fieldNode,
              info,
              args,
              operation,
            ),
            ...userValue,
          };
          return result;
        };
        if (isList) {
          const value = source[selectionName];
          const result = Array.isArray(value)
            ? value.map(generateValue)
            : [generateValue(value as object)];
          return result;
        } else {
          return generateValue(source[selectionName] as object | undefined);
        }
      } else if (isScalarType(namedReturnType)) {
        if (source[selectionName] !== undefined) {
          return source[selectionName];
        }
        const result = mockScalar(
          fieldNode,
          args,
          namedReturnType,
          info,
          source.__abstractType || info.parentType,
          resolveValue,
          isList,
        );
        return result;
      } else if (isEnumType(namedReturnType)) {
        if (source[selectionName] !== undefined) {
          return source[selectionName];
        }
        const enumValues = namedReturnType.getValues().map((e) => e.name);
        return isList ? enumValues : enumValues[0];
      } else {
        return null;
      }
    },
  });
  if (result.errors) {
    if (result.errors.length === 1) {
      throw result.errors[0].originalError;
    }
    throw new Error(`RelayMockPayloadGenerator: ${result.errors.join(", ")}`);
  }
  invariant(result?.data, "Expected to generate a payload");
  return result as { data: MockData };
}

function mockCompositeType(
  mockResolvers: MockResolvers | null,
  namedReturnType: GraphQLNamedType,
  userSpecifiedTypename: string | null,
  resolveValue: ValueResolver,
  fieldNode: FieldNode | null,
  info: GraphQLResolveInfo | null,
  args: { [argName: string]: unknown },
  operation: OperationDescriptor<GraphQLSchema, DocumentNode>,
) {
  // Get the concrete type selection, concrete type on an abstract type
  // selection, or the abstract type selection.
  let typename = userSpecifiedTypename || namedReturnType.name;
  let abstractTypeSelectionOnly = false;
  const abstractType = isAbstractType(namedReturnType);

  if (abstractType) {
    invariant(info, "Expected info to be defined");
    const possibleTypeNames = info.fieldNodes.reduce<string[]>(
      (acc, fieldNode) => [
        ...acc,
        ...getPossibleConcreteTypeNamesFromAbstractTypeSelections(
          operation.schema,
          fieldNode.selectionSet as SelectionSetNode,
          info.fragments,
        ),
      ],
      [],
    );
    if (possibleTypeNames?.length) {
      typename = possibleTypeNames[0];
    } else {
      abstractTypeSelectionOnly = true;
    }
  }

  let result: InternalMockData = {
    ...getDefaultValues(
      mockResolvers,
      // If a mock resolver is provided for the abstract type, use it.
      mockResolvers && mockResolvers[namedReturnType.name]
        ? namedReturnType.name
        : typename,
      resolveValue,
      fieldNode,
      info,
      args,
    ),
  };
  if (
    abstractType &&
    result.__typename &&
    mockResolvers &&
    mockResolvers[namedReturnType.name] &&
    mockResolvers[result.__typename]
  ) {
    // If a mock resolver is provided for both an abstract and a concrete type
    // (for the typename possibly returned by the abstract type mock), merge
    // the results.
    result = deepmerge(
      result,
      getDefaultValues(
        mockResolvers,
        result.__typename,
        resolveValue,
        fieldNode,
        info,
        args,
      ) as InternalMockData,
    );
  }

  if (abstractType && !result[TYPENAME_KEY]) {
    if (abstractTypeSelectionOnly) {
      // When no concrete type selection exists, it means only interface
      // fields are selected, so we can just use the first possible type.
      //
      // We keep a reference to the path so we can rewrite the __typename
      // field in the output after execution to reflect that this not a
      // selection on a concrete type.
      const possibleType =
        operation.schema.getPossibleTypes(namedReturnType)[0];
      invariant(
        possibleType,
        "Expected interface %s to be implemented by at least one concrete type",
        namedReturnType.name,
      );
      typename = possibleType.name;
      invariant(info, "Expected info to be defined");
    }
    result.__typename = typename;
    result.__abstractType = namedReturnType;
  }

  return result;
}

function getDefaultValues(
  mockResolvers: MockResolvers | null,
  typename: string,
  resolveValue: ValueResolver,
  fieldNode: FieldNode | null,
  info: GraphQLResolveInfo | null,
  args: { [argName: string]: unknown },
) {
  const defaultValues =
    mockResolvers?.[typename] &&
    (resolveValue(
      typename,
      {
        parentType: info ? info.parentType.name : null,
        name: fieldNode?.name.value || "",
        alias: fieldNode?.alias?.value || null,
        path: info ? pathToArray(info.path).filter(isString) : [],
        args: args,
      },
      // FIXME: This is disabled here because we're currently doing this work
      // in the field resolver's isCompositeType check.
      // isListType(info.returnType),
      false,
    ) as MockData | undefined);
  invariant(
    defaultValues === undefined || typeof defaultValues === "object",
    "Expected mock resolver to return an object",
  );
  return defaultValues;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
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
  args: { [argName: string]: unknown },
  type: GraphQLScalarType,
  info: GraphQLResolveInfo,
  parentType: GraphQLCompositeType,
  resolveValue: ValueResolver,
  plural: boolean,
) {
  if (fieldNode.name.value === TYPENAME_KEY) {
    return isAbstractType(parentType) ? DEFAULT_MOCK_TYPENAME : parentType.name;
  }
  const context: MockResolverContext = {
    name: fieldNode.name.value,
    alias: fieldNode.alias?.value || null,
    args,
    path: pathToArray(info.path).filter(isString),
    parentType: isAbstractType(parentType)
      ? DEFAULT_MOCK_TYPENAME
      : parentType.name,
  };
  return resolveValue(type.name, context, plural, undefined);
}

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

function removeDeferAndStream(doc: DocumentNode): DocumentNode {
  return visit(doc, {
    Directive: (node) => {
      if (node.name.value === "defer" || node.name.value === "stream") {
        return null;
      }
      return;
    },
  });
}

function getRootType(
  operation: OperationDescriptor,
): GraphQLObjectType | undefined | null {
  const rootType = getOperationAST(operation.request.node);
  invariant(rootType, "Expected operation to have a root type");
  switch (rootType.operation) {
    case "query":
      return operation.schema.getQueryType();
    case "mutation":
      return operation.schema.getMutationType();
    case "subscription":
      return operation.schema.getSubscriptionType();
  }
}
