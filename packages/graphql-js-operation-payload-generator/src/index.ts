import {
  assertCompositeType,
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
  InlineFragmentNode,
  isAbstractType,
  isListType,
  isObjectType,
  isScalarType,
  OperationDefinitionNode,
  SelectionSetNode,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from "graphql";
import { Maybe } from "graphql/jsutils/Maybe";
import invariant from "invariant";

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

function visitDocumentDefinitionNode(
  documentDefinitionNode:
    | OperationDefinitionNode
    | FragmentDefinitionNode
    | InlineFragmentNode,
  schema: GraphQLSchema,
  allDocumentDefinitionNodes: ReadonlyArray<DefinitionNode>,
  mockResolvers: MockResolvers,
  resolveValue: ValueResolver
): MockData {
  const typeInfo = new TypeInfo(schema);
  return visit(
    documentDefinitionNode,
    visitWithTypeInfo(typeInfo, {
      OperationDefinition: {
        leave(operationDefinitionNode) {
          return operationDefinitionNode.selectionSet;
        },
      },
      FragmentDefinition: {
        leave(fragmentDefinitionNode) {
          return fragmentDefinitionNode.selectionSet;
        },
      },
      SelectionSet: {
        enter(selectionSetNode) {
          if (isAbstractType(typeInfo.getType())) {
            /**
             * Only generate data for a single object type.
             */
            return reduceToSingleObjectTypeSelection(
              selectionSetNode,
              schema,
              allDocumentDefinitionNodes,
              typeInfo
            );
          }
        },
        leave(selectionSetNode) {
          /**
           * Always add __typename to object types so it's made available in cases
           * where an abstract parent type had a field selection for it;in which
           * case it needs an object type name, not the abstract type's name.
           */
          const type = typeInfo.getType();
          const startWith = isObjectType(type)
            ? { [TYPENAME_KEY]: type.name }
            : {};
          const selections = (selectionSetNode.selections as unknown[]) as MockData[];
          // TODO: Clean this up
          const data: MockData = startWith;
          selections.forEach((selection) => {
            // Only leave an abstract __typename in case there's no other object __typename
            if (
              selection[TYPENAME_KEY] === DEFAULT_MOCK_TYPENAME &&
              selections.some(
                (sel) =>
                  typeof sel[TYPENAME_KEY] === "string" &&
                  sel[TYPENAME_KEY] !== DEFAULT_MOCK_TYPENAME
              )
            ) {
              selection = { ...selection };
              delete selection[TYPENAME_KEY];
            }
            Object.assign(data, selection);
          });
          return data;
        },
      },
      Field: {
        leave(fieldNode) {
          const mockFieldName = fieldNode.alias?.value || fieldNode.name.value;
          const type = typeInfo.getType();
          invariant(
            type,
            `Expected field to have a type: ${JSON.stringify(fieldNode)}`
          );
          const namedType = getNamedType(type);
          if (isScalarType(namedType)) {
            return {
              [mockFieldName]: mockScalar(
                fieldNode,
                namedType,
                typeInfo.getParentType()!,
                resolveValue
              ),
            };
          } else if (fieldNode.selectionSet) {
            // TODO: Clean this up
            const defaultData = (fieldNode.selectionSet as unknown) as MockData;
            const mockData = mockCompositeType(
              fieldNode,
              assertCompositeType(namedType),
              typeInfo.getParentType()!,
              resolveValue
            );
            const data: MockData = {};
            if (mockData) {
              // Only use fields from the mockData that were actually selected
              Object.keys(defaultData).forEach((fieldName) => {
                data[fieldName] = mockData.hasOwnProperty(fieldName)
                  ? mockData[fieldName]
                  : defaultData[fieldName];
              });
            } else {
              Object.assign(data, defaultData);
            }

            const isList = isListType(getNullableType(type));
            return {
              [mockFieldName]: isList ? [data] : data,
            };
          } else {
            console.log(
              `UNHANDLED TYPE '${type}' for field '${JSON.stringify(
                fieldNode
              )}'`
            );
          }
          return undefined;
        },
      },
      InlineFragment: {
        leave(inlineFragmentNode) {
          return inlineFragmentNode.selectionSet;
        },
      },
      FragmentSpread: {
        leave(fragmentSpreadNode) {
          const fragmentDefinitionNode = findFragmentDefinitionNode(
            allDocumentDefinitionNodes,
            fragmentSpreadNode.name.value
          );
          return visitDocumentDefinitionNode(
            fragmentDefinitionNode,
            schema,
            allDocumentDefinitionNodes,
            mockResolvers,
            resolveValue
          );
        },
      },
    })
  );
}

/**
 * Finds the first fragment spread on an object type and keeps that plus any subsequent
 * fragment spreads for the same object type.
 */
function reduceToSingleObjectTypeSelection(
  selectionSetNode: SelectionSetNode,
  schema: GraphQLSchema,
  allDocumentDefinitionNodes: ReadonlyArray<DefinitionNode>,
  typeInfo: TypeInfo
): SelectionSetNode {
  let reduceToObjectType: GraphQLObjectType | null = null;
  const reducer = (type: Maybe<GraphQLOutputType>) => {
    if (isObjectType(type)) {
      if (!reduceToObjectType) {
        reduceToObjectType = type;
      } else if (reduceToObjectType !== type) {
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
  // type: GraphQLNamedType,
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
