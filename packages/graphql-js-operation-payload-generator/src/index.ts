import {
  assertCompositeType,
  ASTKindToNode,
  DefinitionNode,
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  getNamedType,
  getNullableType,
  GraphQLCompositeType,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLEnumType,
  InlineFragmentNode,
  isAbstractType,
  isListType,
  isObjectType,
  isScalarType,
  OperationDefinitionNode,
  SelectionSetNode,
  TypeInfo,
  visit,
  Visitor,
  visitWithTypeInfo,
} from "graphql";
import { Maybe } from "graphql/jsutils/Maybe";
import invariant from "invariant";
import deepmerge from "deepmerge";

import {
  createValueResolver,
  DEFAULT_MOCK_RESOLVERS,
  DEFAULT_MOCK_TYPENAME,
  MockData,
  MockResolverContext,
  MockResolvers,
  ValueResolver,
} from "./vendor/RelayMockPayloadGenerator";
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

type NodeWithMockData = { userMockData: unknown };

type VisitorWithMockData = Visitor<
  ASTKindToNode & {
    Field: Partial<NodeWithMockData>;
  }
>;

const TYPENAME_KEY = "__typename";

export function generate(
  operation: OperationDescriptor,
  mockResolvers: MockResolvers | null = DEFAULT_MOCK_RESOLVERS
) {
  mockResolvers = { ...DEFAULT_MOCK_RESOLVERS, ...mockResolvers };
  const resolveValue = createValueResolver(mockResolvers);
  const definitions = operation.request.node.definitions;

  const operationDefinitionNode = definitions.find(
    (def) => def.kind === "OperationDefinition"
  ) as OperationDefinitionNode | undefined;
  invariant(operationDefinitionNode, "Expected an operation definition node");

  const result = visitDocumentDefinitionNode(
    operationDefinitionNode,
    operation.schema,
    definitions,
    mockResolvers,
    resolveValue
  );

  return { data: result };
}

function isNodeWithMockData(node: any): node is NodeWithMockData {
  return (
    node !== undefined &&
    (node as Partial<NodeWithMockData>).userMockData !== undefined
  );
}

/**
 * Transforms a graphql-js AST to mock data.
 *
 * We generate the data upon entering a node and return the data when leaving
 * the node.
 */
function visitDocumentDefinitionNode(
  documentDefinitionNode:
    | OperationDefinitionNode
    | (FragmentDefinitionNode & Partial<NodeWithMockData>),
  schema: GraphQLSchema,
  allDocumentDefinitionNodes: ReadonlyArray<DefinitionNode>,
  mockResolvers: MockResolvers,
  resolveValue: ValueResolver
): MockData {
  const typeInfo = new TypeInfo(schema);
  const visitor: VisitorWithMockData = {
    OperationDefinition: {
      /**
       * Return collected mock data
       */
      leave(operationDefinitionNode) {
        return operationDefinitionNode.selectionSet;
      },
    },
    FragmentDefinition: {
      /**
       * Return collected mock data
       */
      leave(fragmentDefinitionNode) {
        return fragmentDefinitionNode.selectionSet;
      },
    },
    InlineFragment: {
      /**
       * Return collected mock data
       */
      leave(inlineFragmentNode) {
        return inlineFragmentNode.selectionSet;
      },
    },
    FragmentSpread: {
      /**
       * Visit referenced fragment and return collected MockData
       */
      leave(fragmentSpreadNode, _key, _parent, _path, ancestors) {
        // From the parent Field/FragmentDefinition node, get existing user
        // mock data and make it available to the new visitor.
        const parentNodeWithMockData = ancestors[ancestors.length - 2];
        const userMockData = isNodeWithMockData(parentNodeWithMockData)
          ? parentNodeWithMockData.userMockData
          : undefined;

        const fragmentDefinitionNode = findFragmentDefinitionNode(
          allDocumentDefinitionNodes,
          fragmentSpreadNode.name.value
        );
        return visitDocumentDefinitionNode(
          { ...fragmentDefinitionNode, userMockData },
          schema,
          allDocumentDefinitionNodes,
          mockResolvers,
          resolveValue
        );
      },
    },
    SelectionSet: {
      /**
       * Reduce possible concrete types for abstract type to a single one.
       */
      enter(selectionSetNode, _key, parent) {
        if (isAbstractType(typeInfo.getType())) {
          return reduceToSingleObjectTypeSelection(
            selectionSetNode,
            isNodeWithMockData(parent)
              ? (parent.userMockData as MockData)[TYPENAME_KEY]
              : undefined,
            schema,
            allDocumentDefinitionNodes,
            typeInfo
          );
        }
      },
      /**
       * Merge mock data of all selections and return it
       */
      leave(selectionSetNode) {
        const type = typeInfo.getType();
        const mocksData = (selectionSetNode.selections as unknown[]) as MockData[];

        /**
         * Always add __typename to object types so it's made available in cases
         * where an abstract parent type had a field selection for it; in which
         * case it needs an object type name, not the abstract type's name.
         */
        // First search for a schema typename...
        let typename = mocksData.find(
          (sel) =>
            typeof sel[TYPENAME_KEY] === "string" &&
            sel[TYPENAME_KEY] !== DEFAULT_MOCK_TYPENAME
        )?.[TYPENAME_KEY];
        // ...otherwise use the current type, if it's an object type...
        if (!typename && isObjectType(type)) {
          typename = type.name;
        }
        // ...or fallback to a DEFAULT_MOCK_TYPENAME selection.
        if (
          !typename &&
          mocksData.some((sel) => sel[TYPENAME_KEY] === DEFAULT_MOCK_TYPENAME)
        ) {
          typename = DEFAULT_MOCK_TYPENAME;
        }

        const mockData: MockData = deepmerge.all(mocksData) as MockData;
        if (typename) {
          delete mockData[TYPENAME_KEY];
          return {
            [TYPENAME_KEY]: typename,
            ...mockData,
          };
        } else {
          return mockData;
        }
      },
    },
    Field: {
      /**
       * Generate mock data
       */
      enter(fieldNode) {
        const type = typeInfo.getType();
        invariant(
          type,
          `Expected field to have a type: ${JSON.stringify(fieldNode)}`
        );
        const namedType = getNamedType(type);
        if (isScalarType(namedType)) {
          const fieldWithMockData: typeof fieldNode = {
            ...fieldNode,
            userMockData: mockScalar(
              fieldNode,
              namedType,
              typeInfo.getParentType()!,
              resolveValue
            ),
          };
          return fieldWithMockData;
        } else if (namedType instanceof GraphQLEnumType) {
          const fieldWithMockData: typeof fieldNode = {
            ...fieldNode,
            userMockData: namedType.getValues()[0].value,
          };
          return fieldWithMockData;
        } else {
          invariant(
            fieldNode.selectionSet,
            "Expected field with selection set"
          );
          const fieldWithMockData: typeof fieldNode = {
            ...fieldNode,
            userMockData: mockCompositeType(
              fieldNode,
              assertCompositeType(namedType),
              typeInfo.getParentType()!,
              resolveValue
            ),
          };
          return fieldWithMockData;
        }
      },
      /**
       * Merge default mock data and explicit user mock data and return it
       */
      leave(fieldNode) {
        const mockData = fieldNode.userMockData;
        const mockFieldName = fieldNode.alias?.value || fieldNode.name.value;

        if (!fieldNode.selectionSet) {
          return {
            [mockFieldName]: mockData,
          };
        }

        const defaultData = (fieldNode.selectionSet as unknown) as MockData;
        const data: MockData = {};
        if (mockData) {
          // Only use fields from the mockData that were actually selected
          Object.keys(defaultData).forEach((fieldName) => {
            data[fieldName] = (mockData as MockData).hasOwnProperty(fieldName)
              ? (mockData as MockData)[fieldName]
              : defaultData[fieldName];
          });
        } else {
          Object.assign(data, defaultData);
        }

        const type = typeInfo.getType();
        const isList = isListType(getNullableType(type!));
        return {
          [mockFieldName]: isList ? [data] : data,
        };
      },
    },
  };
  return visit(documentDefinitionNode, visitWithTypeInfo(typeInfo, visitor));
}

/**
 * Finds the first fragment spread on an object type and keeps that plus any subsequent
 * fragment spreads for the same object type.
 */
function reduceToSingleObjectTypeSelection(
  selectionSetNode: SelectionSetNode,
  explicitTypename: string | undefined,
  schema: GraphQLSchema,
  allDocumentDefinitionNodes: ReadonlyArray<DefinitionNode>,
  typeInfo: TypeInfo
): SelectionSetNode {
  let reduceToObjectType: GraphQLObjectType | null = null;
  const reducer = (type: Maybe<GraphQLOutputType>) => {
    if (isObjectType(type)) {
      if (
        // Select the first type we come across...
        reduceToObjectType === null &&
        // ...but only if the name matches, when an explicit one is given.
        (explicitTypename === undefined || type.name === explicitTypename)
      ) {
        reduceToObjectType = type;
      } else if (
        // If no types matched the explicit name yet...
        reduceToObjectType === null ||
        // ...or if the type is not the selected type...
        reduceToObjectType !== type
      ) {
        // ...remove this fragment.
        return null;
      }
    }
    return false;
  };
  return visit(
    selectionSetNode,
    visitWithTypeInfo(typeInfo, {
      InlineFragment() {
        return reducer(typeInfo.getType());
      },
      FragmentSpread(fragmentSpreadNode) {
        const fragmentDefinitionNode = findFragmentDefinitionNode(
          allDocumentDefinitionNodes,
          fragmentSpreadNode.name.value
        );
        const type = schema.getType(
          fragmentDefinitionNode.typeCondition.name.value
        );
        return reducer(type as GraphQLOutputType);
      },
    })
  );
}

function findFragmentDefinitionNode(
  allDocumentDefinitionNodes: ReadonlyArray<DefinitionNode>,
  name: string
) {
  const fragmentDefinitionNode = allDocumentDefinitionNodes.find(
    (def) => def.kind === "FragmentDefinition" && def.name.value === name
  ) as FragmentDefinitionNode | undefined;
  invariant(
    fragmentDefinitionNode,
    `Expected a fragment by name '${name}' to exist`
  );
  return fragmentDefinitionNode;
}

function mockScalar(
  fieldNode: FieldNode,
  type: GraphQLScalarType,
  parentType: GraphQLCompositeType,
  resolveValue: ValueResolver
) {
  if (fieldNode.name.value === TYPENAME_KEY) {
    return isAbstractType(parentType) ? DEFAULT_MOCK_TYPENAME : parentType.name;
  }
  const args =
    fieldNode.arguments &&
    fieldNode.arguments.reduce(
      (acc, arg) => ({ ...acc, [arg.name.value]: arg.value }),
      {}
    );
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

function mockCompositeType(
  fieldNode: FieldNode,
  type: GraphQLCompositeType,
  parentType: GraphQLCompositeType,
  resolveValue: ValueResolver
): MockData | undefined {
  const args =
    fieldNode.arguments &&
    fieldNode.arguments.reduce(
      (acc, arg) => ({ ...acc, [arg.name.value]: arg.value }),
      {}
    );
  const context: MockResolverContext = {
    name: fieldNode.name.value,
    alias: fieldNode.alias?.value,
    args,
    parentType: isAbstractType(parentType)
      ? DEFAULT_MOCK_TYPENAME
      : parentType.name,
  };
  const data = resolveValue(type.name, context, false, undefined) as MockData;
  // TODO: This is what they do upstream, it doesn't smell right
  return typeof data === "object" ? data : undefined;
}
