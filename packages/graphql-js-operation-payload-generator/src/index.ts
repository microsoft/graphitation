/**
 * TODO:
 *
 * - rename `unknown` type back to `mixed` and alias instead
 */

/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @emails oncall+relay
 * @flow strict-local
 * @format
 */

// flowlint ambiguous-object-type:error

// 'use strict';

// const invariant = require('invariant');

// const {
//   TYPENAME_KEY,
//   RelayConcreteNode,
//   getModuleComponentKey,
//   getModuleOperationKey,
// } = require('relay-runtime');

// const {
//   CLIENT_COMPONENT,
//   CLIENT_EXTENSION,
//   CONDITION,
//   CONNECTION,
//   DEFER,
//   FLIGHT_FIELD,
//   FRAGMENT_SPREAD,
//   INLINE_FRAGMENT,
//   LINKED_FIELD,
//   LINKED_HANDLE,
//   MODULE_IMPORT,
//   SCALAR_FIELD,
//   SCALAR_HANDLE,
//   STREAM,
//   TYPE_DISCRIMINATOR,
// } = RelayConcreteNode;

// import type {
//   NormalizationArgument,
//   NormalizationField,
//   NormalizationLinkedField,
//   NormalizationOperation,
//   NormalizationScalarField,
//   NormalizationSelection,
//   OperationDescriptor,
//   GraphQLSingularResponse,
//   NormalizationSplitOperation,
//   Variables,
// } from 'relay-runtime';

import type {
  DocumentNode,
  FieldNode,
  OperationDefinitionNode,
  SelectionNode,
  GraphQLSchema,
  ArgumentNode,
  ValueNode,
  FragmentSpreadNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
} from "graphql";
import {
  getNamedType,
  getNullableType,
  isAbstractType,
  isCompositeType,
  isEnumType,
  isListType,
  isNullableType,
  isScalarType,
  isObjectType,
  isInterfaceType,
} from "graphql";
import invariant from "invariant";

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

export type MockResolverContext = Readonly<{
  parentType: string | null | undefined;
  name: string | null;
  alias: string | null;
  path: ReadonlyArray<string> | null;
  args: Record<string, unknown> | null;
}>;

type MockResolver = (
  context: MockResolverContext,
  generateId: () => number
) => unknown;

export type MockResolvers = Record<string, MockResolver>;

type mixed = unknown;

type ValueResolver = (
  typeName: string | null, // | undefined,
  context: MockResolverContext,
  plural?: boolean,
  defaultValue?: unknown
) => unknown;
type Traversable = {
  selections: ReadonlyArray<SelectionNode>;
  typeName: string | null | undefined;
  isAbstractType: boolean | null;
  name: string | null;
  alias: string | null;
  args: Record<string, unknown> | null;
};
// type MockData = {[string]: mixed, ...};
// type MockResolverContext = {|
//   +parentType: ?string,
//   +name: ?string,
//   +alias: ?string,
//   +path: ?$ReadOnlyArray<string>,
//   +args: ?{[string]: mixed, ...},
// |};
// type MockResolver = (
//   context: MockResolverContext,
//   generateId: () => number,
// ) => mixed;
// export type MockResolvers = {[typeName: string]: MockResolver, ...};

// type SelectionMetadata = {
//   [selectionPath: string]: {|
//     +type: string,
//     +plural: boolean,
//     +nullable: boolean,
//     +enumValues: $ReadOnlyArray<string> | null,
//   |},
//   ...
// };

type NormalizationLinkedField = {
  alias: string | null;
  name: string;
  args: ReadonlyArray<ArgumentNode> | null;
  concreteType: string | null;
  plural: boolean;
  selections: ReadonlyArray<SelectionNode>;
};

const TYPENAME_KEY = "__typename";

const SCALAR_FIELD = "SCALAR_FIELD";
const LINKED_FIELD = "LINKED_FIELD";
const FRAGMENT_SPREAD = "FRAGMENT_SPREAD";
const INLINE_FRAGMENT = "INLINE_FRAGMENT";

function createIdGenerator() {
  let id = 0;
  return () => {
    return ++id;
  };
}

const DEFAULT_MOCK_RESOLVERS: Record<string, MockResolver> = {
  ID(context, generateId: () => number) {
    return `<${
      context.parentType != null && context.parentType !== DEFAULT_MOCK_TYPENAME
        ? context.parentType + "-"
        : ""
    }mock-id-${generateId()}>`;
  },
  Boolean() {
    return false;
  },
  Int() {
    return 42;
  },
  Float() {
    return 4.2;
  },
};

const DEFAULT_MOCK_TYPENAME = "__MockObject";

/**
 * Basic value resolver
 */
function valueResolver(
  generateId: () => number,
  mockResolvers: MockResolvers | null,
  typeName: string | null,
  context: MockResolverContext,
  plural: boolean = false,
  defaultValue?: unknown
): unknown {
  const generateValue = (possibleDefaultValue: mixed) => {
    let mockValue;
    const mockResolver =
      typeName != null && mockResolvers != null
        ? mockResolvers[typeName]
        : null;
    if (mockResolver != null) {
      mockValue = mockResolver(context, generateId);
    }
    if (mockValue === undefined) {
      mockValue =
        possibleDefaultValue ??
        (typeName === "ID"
          ? DEFAULT_MOCK_RESOLVERS.ID(context, generateId)
          : `<mock-value-for-field-"${
              context.alias ?? context.name ?? "undefined"
            }">`);
    }
    return mockValue;
  };

  return plural === true
    ? generateMockList(
        Array.isArray(defaultValue) ? defaultValue : Array(1).fill(undefined),
        generateValue
      )
    : generateValue(defaultValue);
}

function createValueResolver(
  mockResolvers: MockResolvers | null
): ValueResolver {
  const generateId = createIdGenerator();
  return (...args) => {
    return valueResolver(generateId, mockResolvers, ...args);
  };
}

function generateMockList<T>(
  placeholderArray: ReadonlyArray<mixed>,
  generateListItem: (defaultValue: mixed) => T
): ReadonlyArray<T> {
  return placeholderArray.map((possibleDefaultValue) =>
    generateListItem(possibleDefaultValue)
  );
}

class RelayMockPayloadGenerator {
  _variables: Variables;
  _resolveValue: ValueResolver;
  _mockResolvers: MockResolvers;
  _selectionMetadata: SelectionMetadata;
  _schema: GraphQLSchema;
  _fragmentNodes: FragmentDefinitionNode[];

  constructor(options: {
    variables: Variables;
    mockResolvers: MockResolvers | null;
    selectionMetadata: SelectionMetadata | null;
    schema: GraphQLSchema;
    fragmentNodes: FragmentDefinitionNode[];
  }) {
    this._variables = options.variables;
    // $FlowFixMe[cannot-spread-indexer]
    // $FlowFixMe[cannot-spread-inexact]
    // $FlowFixMe[incompatible-type]
    this._mockResolvers = {
      ...DEFAULT_MOCK_RESOLVERS,
      ...(options.mockResolvers ?? {}),
    };
    this._selectionMetadata = options.selectionMetadata ?? {};
    // $FlowFixMe[incompatible-call]
    this._resolveValue = createValueResolver(this._mockResolvers);
    this._schema = options.schema;
    this._fragmentNodes = options.fragmentNodes;
  }

  generate(
    selections: ReadonlyArray<SelectionNode>, // TODO: Perhaps this should just be a SelectionSetNode ?
    operationType: string // TODO: Should this be a union of operation strings?
  ): MockData {
    const defaultValues = this._getDefaultValuesForObject(
      operationType,
      null,
      null,
      [], // path
      {}
    );
    return this._traverse(
      {
        selections,
        typeName: operationType,
        isAbstractType: false,
        name: null,
        alias: null,
        args: null,
      },
      [], // path
      null, // prevData
      defaultValues
    );
  }

  _traverse(
    traversable: Traversable,
    path: ReadonlyArray<string>,
    prevData: MockData | null,
    defaultValues: MockData | null
  ): MockData {
    const { selections, typeName, isAbstractType } = traversable;

    return this._traverseSelections(
      selections,
      typeName,
      isAbstractType,
      path,
      prevData,
      defaultValues
    );
  }

  /**
   * Generate mock values for selection of fields
   */
  _traverseSelections(
    selections: ReadonlyArray<SelectionNode>,
    typeName: string | null | undefined,
    isAbstractType: boolean | null,
    path: ReadonlyArray<string>,
    prevData: MockData | null,
    defaultValues: MockData | null
  ): MockData {
    let mockData: MockData | null = prevData ?? {};

    selections.forEach((selection) => {
      let kind: string | null = null;
      if (selection.kind === "Field") {
        if (selection.name.value === TYPENAME_KEY) {
          kind = SCALAR_FIELD;
        } else {
          const type = typeName == null ? null : this._schema.getType(typeName);
          invariant(
            isObjectType(type) || isInterfaceType(type),
            "Expected to have a object or interface type"
          );
          const fieldDef = type.getFields()[selection.name.value];
          invariant(
            fieldDef,
            `Expected type "${typeName}" to have field definition of "${selection.name.value}"`
          );
          const fieldType = getNamedType(fieldDef.type);
          if (isScalarType(fieldType) || isEnumType(fieldType)) {
            kind = SCALAR_FIELD;
          } else if (isCompositeType(fieldType)) {
            kind = LINKED_FIELD;
          }
        }
      }
      if (!kind) {
        if (selection.kind === "FragmentSpread") {
          kind = FRAGMENT_SPREAD;
        } else if (selection.kind === "InlineFragment") {
          kind = INLINE_FRAGMENT;
        }
      }
      switch (kind) {
        case SCALAR_FIELD: {
          mockData = this._mockScalar(
            selection as FieldNode,
            typeName,
            path,
            mockData,
            defaultValues
          );
          break;
        }
        //         // $FlowFixMe[incompatible-type]
        //         case CONNECTION: {
        //           mockData = this._traverseSelections(
        //             [selection.edges, selection.pageInfo],
        //             typeName,
        //             isAbstractType,
        //             path,
        //             prevData,
        //             defaultValues,
        //           );
        //           break;
        //         }
        case LINKED_FIELD: {
          mockData = this._mockLink(
            selection as FieldNode,
            path,
            mockData,
            defaultValues,
            typeName
          );
          break;
        }
        //         case CONDITION:
        //           const conditionValue = this._getVariableValue(selection.condition);
        //           if (conditionValue === selection.passingValue) {
        //             mockData = this._traverseSelections(
        //               selection.selections,
        //               typeName,
        //               isAbstractType,
        //               path,
        //               mockData,
        //               defaultValues,
        //             );
        //           }
        //           break;

        //         case DEFER:
        //         case STREAM: {
        //           mockData = this._traverseSelections(
        //             selection.selections,
        //             typeName,
        //             isAbstractType,
        //             path,
        //             mockData,
        //             defaultValues,
        //           );
        //           break;
        //         }

        //         case CLIENT_COMPONENT:
        case FRAGMENT_SPREAD: {
          const fragmentName = (selection as FragmentSpreadNode).name.value;
          const fragmentNode = this._fragmentNodes.find(
            (def) => def.name.value === fragmentName
          );
          invariant(
            fragmentNode,
            `Expected to find a fragment by name "${fragmentName}"`
          );
          mockData = this._traverseSelections(
            fragmentNode.selectionSet.selections,
            fragmentNode.typeCondition.name.value,
            isAbstractType,
            path,
            mockData,
            defaultValues
          );
          break;
        }

        case INLINE_FRAGMENT: {
          const selectionType =
            (selection as InlineFragmentNode).typeCondition?.name.value ||
            typeName;

          // TODO: Understand what this is and if we can use it/need it
          //
          // const { abstractKey } = selection;
          // if (abstractKey != null) {
          //   if (mockData != null) {
          //     mockData[abstractKey] = true;
          //   }
          //   mockData = this._traverseSelections(
          //     selection.selections,
          //     typeName,
          //     isAbstractType,
          //     path,
          //     mockData,
          //     defaultValues
          //   );
          //   break;
          // }

          // If it's the first time we're trying to handle fragment spread
          // on this selection, we will generate data for this type.
          // Next fragment spread on this selection will be added only if the
          // types are matching
          if (
            mockData != null &&
            (mockData[TYPENAME_KEY] == null ||
              mockData[TYPENAME_KEY] === DEFAULT_MOCK_TYPENAME)
          ) {
            mockData[TYPENAME_KEY] =
              defaultValues?.[TYPENAME_KEY] ?? selectionType;
          }
          // Now, we need to make sure that we don't select abstract type
          // for inline fragments
          if (
            isAbstractType === true &&
            mockData != null &&
            mockData[TYPENAME_KEY] === typeName
          ) {
            mockData[TYPENAME_KEY] = selectionType;
          }
          if (mockData != null && mockData[TYPENAME_KEY] === selectionType) {
            // This will get default values for current selection type
            const defaults = this._getDefaultValuesForObject(
              selectionType,
              path[path.length - 1],
              null,
              path
            );

            // Also, if the selection has an abstract type
            // we may have mock resolvers for it
            const defaultsForAbstractType =
              typeName !== selectionType
                ? this._getDefaultValuesForObject(
                    typeName,
                    path[path.length - 1],
                    null,
                    path
                  )
                : defaults;

            // Now let's select which defaults we're going to use
            // for the selections
            let defaultValuesForSelection = defaults; // First, defaults for
            // concrete type of the selection
            if (defaultValuesForSelection === undefined) {
              // Second, defaults for abstract type of the selection
              defaultValuesForSelection = defaultsForAbstractType;
            }
            // And last, values from the parent mock resolver
            if (defaultValuesForSelection === undefined) {
              defaultValuesForSelection = defaultValues;
            }
            // Now, if the default value for the type is explicit null,
            // we may skip traversing child selection
            if (defaultValuesForSelection === null) {
              mockData = null;
              break;
            }

            mockData = this._traverseSelections(
              (selection as InlineFragmentNode).selectionSet.selections,
              selectionType,
              isAbstractType,
              path,
              mockData,
              defaultValuesForSelection
            );

            if (mockData[TYPENAME_KEY] != null) {
              mockData[TYPENAME_KEY] = selectionType;
            }

            // Make sure we're using id form the default values, an
            // ID may be referenced in the same selection as InlineFragment
            if (
              mockData.id != null &&
              defaults != null &&
              defaults.id != null
            ) {
              mockData.id = defaults.id;
            }
          }
          break;
        }

        //         case MODULE_IMPORT:
        //           // Explicit `null` of `defaultValues` handled in the INLINE_FRAGMENT
        //           if (defaultValues != null) {
        //             if (defaultValues.__typename !== typeName) {
        //               break;
        //             }
        //             // In order to mock 3d payloads, we need to receive an object with
        //             // the type `NormalizationSplitOperation` from mock resolvers.
        //             // In this case, we can traverse into its selection
        //             // and generated payloads for it.
        //             const operation = defaultValues.__module_operation;

        //             // Basic sanity checks of the provided default value.
        //             // It should look like NormalizationSplitOperation
        //             invariant(
        //               typeof operation === 'object' &&
        //                 operation !== null &&
        //                 operation.kind === 'SplitOperation' &&
        //                 Array.isArray(operation.selections) &&
        //                 typeof operation.name === 'string',
        //               'RelayMockPayloadGenerator(): Unexpected default value for ' +
        //                 'a field `__module_operation` in the mock resolver for ' +
        //                 '@module dependency. Provided value is "%s" and we\'re ' +
        //                 'expecting an object of a type `NormalizationSplitOperation`. ' +
        //                 'Please adjust mock resolver for the type "%s". ' +
        //                 'Typically it should require a file "%s$normalization.graphql".',
        //               JSON.stringify(operation),
        //               typeName,
        //               selection.fragmentName,
        //             );

        //             const splitOperation: NormalizationSplitOperation = (operation: $FlowFixMe);
        //             const {documentName} = selection;
        //             if (mockData == null) {
        //               mockData = {};
        //             }
        //             // $FlowFixMe[cannot-spread-indexer]
        //             mockData = {
        //               ...mockData,
        //               [TYPENAME_KEY]: typeName,
        //               [getModuleOperationKey(documentName)]: operation.name,
        //               [getModuleComponentKey(
        //                 documentName,
        //               )]: defaultValues.__module_component,
        //               ...this._traverseSelections(
        //                 splitOperation.selections,
        //                 typeName,
        //                 false,
        //                 path,
        //                 null,
        //                 null,
        //               ),
        //             };
        //           }
        //           break;
        //         case CLIENT_EXTENSION:
        //           // We do not expect to receive data for the client extensions
        //           // from the server. MockPayloadGenerator should not generate it too.
        //           break;
        //         case TYPE_DISCRIMINATOR:
        //           const {abstractKey} = selection;
        //           if (mockData != null) {
        //             mockData[abstractKey] = true;
        //           }
        //           break;
        //         case SCALAR_HANDLE:
        //         case LINKED_HANDLE:
        //           break;
        //         case FLIGHT_FIELD:
        //           throw new Error('Flight fields are not yet supported.');
        default: {
          // (selection: empty);
          console.log({ selection });
          invariant(
            false,
            "RelayMockPayloadGenerator(): Unexpected AST kind `%s`.",
            selection.kind
          );
        }
      }
    });
    // $FlowFixMe[incompatible-return]
    return mockData;
  }

  /**
   * Generate default enum value
   * @private
   */
  _getCorrectDefaultEnum(
    enumValues: ReadonlyArray<string>,
    value: unknown | Array<unknown>,
    path: ReadonlyArray<string>,
    applicationName: string
  ) {
    if (value === undefined) {
      return value;
    }

    if (value === null) {
      // null is a valid enum value
      return value;
    }

    const valueToValidate = Array.isArray(value)
      ? value.map((v) => String(v).toUpperCase())
      : [String(value).toUpperCase()];
    const enumValuesNormalized = enumValues.map((s) => s.toUpperCase());

    // Let's validate the correctness of the provided enum value
    // We will throw if value provided by mock resolvers is invalid
    const correctValues = valueToValidate.filter((v) =>
      enumValuesNormalized.includes(v)
    );

    if (correctValues.length !== valueToValidate.length) {
      invariant(
        false,
        'RelayMockPayloadGenerator: Invalid value "%s" provided for enum ' +
          'field "%s" via MockResolver.' +
          "Expected one of the following values: %s.",
        value,
        `${path.join(".")}.${applicationName}`,
        enumValues.map((v) => `"${v}"`).join(", ")
      );
    }

    // But missing case should be acceptable, we will just use
    // a correct spelling from enumValues
    const correctSpellingValues = valueToValidate.map((v) => {
      const correctSpellingEnumIndex = enumValuesNormalized.indexOf(
        String(v).toUpperCase()
      );

      return enumValues[correctSpellingEnumIndex];
    });

    return Array.isArray(value)
      ? correctSpellingValues
      : correctSpellingValues[0];
  }

  /**
   * Generate mock value for a scalar field in the selection
   */
  _mockScalar(
    field: FieldNode,
    typeName: string | null | undefined,
    path: ReadonlyArray<string>,
    mockData: MockData | null,
    defaultValues: MockData | null
  ): MockData {
    const data = mockData ?? {};
    const applicationName = (field.alias ?? field.name).value;
    if (
      data.hasOwnProperty(applicationName) &&
      field.name.value !== TYPENAME_KEY
    ) {
      return data;
    }

    let value;

    // For __typename fields we are going to return typeName
    if (field.name.value === TYPENAME_KEY) {
      value = typeName ?? DEFAULT_MOCK_TYPENAME;
    }

    const selectionPath = [...path, applicationName];
    const { type, plural, enumValues } = this._getScalarFieldTypeDetails(
      field,
      typeName,
      selectionPath
    );

    // We may have an object with default values (generated in _mockLink(...))
    // let's check if we have a possible default value there for our field
    if (
      defaultValues != null &&
      defaultValues.hasOwnProperty(applicationName)
    ) {
      value = defaultValues[applicationName];

      if (enumValues != null) {
        value = this._getCorrectDefaultEnum(
          enumValues,
          value,
          path,
          applicationName
        );
      }

      // And if it's a plural field, we need to return an array
      if (value !== undefined && plural && !Array.isArray(value)) {
        value = [value];
      }
    }

    // If the value has not been generated yet (__id, __typename fields, or defaults)
    // then we need to generate mock value for a scalar type
    if (value === undefined) {
      // Get basic type information: type of the field (Int, Float, String, etc..)
      // And check if it's a plural type
      const defaultValue = enumValues != null ? enumValues[0] : undefined;

      value = this._resolveValue(
        // If we don't have schema let's assume that fields with name (id, __id)
        // have type ID
        type,
        {
          parentType: typeName,
          name: field.name.value,
          alias: field.alias?.value || null,
          path: selectionPath,
          args: this._getFieldArgs(field),
        },
        plural,
        defaultValue
      );
    }
    data[applicationName] = value;
    return data;
  }

  _getNormalizationLinkedField(
    fieldNode: FieldNode,
    typeFromSelection: {
      type: string;
      plural: boolean;
      enumValues: ReadonlyArray<string> | null;
      nullable: boolean;
    } | null
  ) {
    let concreteType: string | null = null;
    if (typeFromSelection) {
      if (isObjectType(this._schema.getType(typeFromSelection.type))) {
        concreteType = typeFromSelection.type;
      }
      // else if (isAbstractType(this._schema.getType(typeFromSelection.type))) {
      //   const fragmentSpread = fieldNode.selectionSet!.selections.find(
      //     (selection) =>
      //       selection.kind === "FragmentSpread" ||
      //       selection.kind === "InlineFragment"
      //   ) as FragmentSpreadNode | InlineFragmentNode | undefined;
      //   if (fragmentSpread) {
      //     concreteType =
      //       (fragmentSpread.kind === "InlineFragment"
      //         ? fragmentSpread.typeCondition?.name.value
      //         : this._fragmentNodes.find(
      //             (def) => def.name.value === fragmentSpread.name.value
      //           )?.typeCondition.name.value) || null;
      //   }
      // }
    }
    const field: NormalizationLinkedField = {
      name: fieldNode.name.value,
      alias: fieldNode.alias?.value || null,
      // TODO: Should conreteType be an unwrapped type perhaps?
      concreteType,
      plural: typeFromSelection === null ? false : typeFromSelection.plural,
      args: fieldNode.arguments || null,
      selections: fieldNode.selectionSet!.selections,
    };
    return field;
  }

  /**
   * Generate mock data for linked fields in the selection
   */
  _mockLink(
    fieldNode: FieldNode,
    path: ReadonlyArray<string>,
    prevData: MockData | null,
    defaultValues: MockData | null,
    parentType: string | null | undefined
  ): MockData | null {
    const _typeFromSelection = this._getLinkedFieldTypeDetails(
      fieldNode,
      parentType
    );
    const field = this._getNormalizationLinkedField(
      fieldNode,
      _typeFromSelection
    );

    const applicationName = field.alias ?? field.name;
    const data = prevData ?? {};
    const args = this._getFieldArgs(fieldNode);

    // Let's check if we have a custom mock resolver for the object type
    // We will pass this data down to selection, so _mockScalar(...) can use
    // values from `defaults`
    const selectionPath = [...path, applicationName];
    const typeFromSelection = _typeFromSelection ?? {
      type: DEFAULT_MOCK_TYPENAME,
    };

    let defaults: MockData | null | undefined;
    if (
      defaultValues != null &&
      typeof defaultValues[applicationName] === "object"
    ) {
      defaults = defaultValues[applicationName] as MockData;
    }

    // In cases when we have explicit `null` in the defaults - let's return
    // null for full branch
    if (defaults === null) {
      data[applicationName] = null;
      return data;
    }

    // If concrete type is null, let's try to get if from defaults,
    // and fallback to default object type
    const typeName =
      field.concreteType ??
      (defaults != null && typeof defaults[TYPENAME_KEY] === "string"
        ? defaults[TYPENAME_KEY]
        : typeFromSelection.type);

    // Let's assume, that if the concrete type is null and selected type name is
    // different from type information form selection, most likely this type
    // information came from mock resolver __typename value and it was
    // an intentional selection of the specific type
    const isAbstractType =
      field.concreteType === null && typeName === typeFromSelection.type;

    const generateDataForField = (possibleDefaultValue: mixed) => {
      const fieldDefaultValue =
        this._getDefaultValuesForObject(
          field.concreteType ?? typeFromSelection.type,
          field.name,
          field.alias,
          selectionPath,
          args
        ) ?? possibleDefaultValue;

      if (fieldDefaultValue === null) {
        return null;
      }
      return this._traverse(
        {
          selections: field.selections,
          typeName,
          isAbstractType: isAbstractType,
          name: field.name,
          alias: field.alias,
          args,
        },
        [...path, applicationName],
        typeof data[applicationName] === "object"
          ? // $FlowFixMe[incompatible-variance]
            (data[applicationName] as MockData)
          : null,
        // $FlowFixMe[incompatible-call]
        // $FlowFixMe[incompatible-variance]
        fieldDefaultValue as MockData
      );
    };
    data[applicationName] =
      // TODO: How could kind ever not be LinkedField ?
      // field.kind === "LinkedField" && field.plural
      field.plural
        ? generateMockList(
            Array.isArray(defaults) ? defaults : Array(1).fill(undefined),
            generateDataForField
          )
        : generateDataForField(defaults);

    return data;
  }

  /**
   * Get the value for a variable by name
   */
  _getVariableValue(name: string): mixed {
    invariant(
      this._variables.hasOwnProperty(name),
      "RelayMockPayloadGenerator(): Undefined variable `%s`.",
      name
    );
    // $FlowFixMe[cannot-write]
    return this._variables[name];
  }

  /**
   * This method should call mock resolver for a specific type name
   * and the result of this mock resolver will be passed as a default values for
   * _mock*(...) methods
   */
  _getDefaultValuesForObject(
    typeName: string | null | undefined,
    fieldName: string | null,
    fieldAlias: string | null,
    path: ReadonlyArray<string>,
    args?: Record<string, unknown> | null
  ): MockData | null {
    let data;
    if (typeName != null && this._mockResolvers[typeName] != null) {
      data = this._resolveValue(
        typeName,
        {
          parentType: null,
          name: fieldName,
          alias: fieldAlias,
          args: args || null,
          path,
        },
        false
      );
    }
    if (typeof data === "object") {
      // $FlowFixMe[incompatible-variance]
      return data as MockData;
    }
    return null;
  }

  /**
   * Get object with variables for field
   */
  _getFieldArgs(field: FieldNode): Record<string, unknown> {
    const args: Record<string, unknown> = {};
    if (field.arguments != null) {
      field.arguments.forEach((arg) => {
        args[arg.name.value] = this._getArgValue(arg.value);
      });
    }
    return args;
  }

  _getArgValue(arg: ValueNode): unknown {
    switch (arg.kind) {
      case "IntValue":
      case "FloatValue":
      case "StringValue":
      case "BooleanValue":
      case "EnumValue":
        return arg.value;
      case "NullValue":
        return null;
      case "Variable":
        return this._getVariableValue(arg.name.value);
      case "ObjectValue": {
        const value: Record<string, unknown> = {};
        arg.fields.forEach((field) => {
          value[field.name.value] = this._getArgValue(field.value);
        });
        return value;
      }
      case "ListValue": {
        const value: unknown[] = [];
        arg.values.forEach((item) => {
          value.push(item != null ? this._getArgValue(item) : null);
        });
        return value;
      }
    }
  }

  /**
   * Helper function to get field type information (name of the type, plural)
   */
  _getScalarFieldTypeDetails(
    field: FieldNode,
    typeName: string | null | undefined,
    _selectionPath: ReadonlyArray<string> // TODO: Remove?
  ): {
    type: string;
    plural: boolean;
    enumValues: ReadonlyArray<string> | null;
    nullable: boolean;
  } {
    // TODO: Check if this can really be null in our case where we have the schema
    //       or if we can have an invariant assertion
    const parentType = typeName == null ? null : this._schema.getType(typeName);
    if (parentType) {
      invariant(
        isObjectType(parentType) || isInterfaceType(parentType),
        "Expected parent type to be one with selectable fields"
      );
      const fieldDef = parentType.getFields()[field.name.value];
      // invariant(fieldDef, "Expected parent type to have current field");
      if (fieldDef) {
        const namedType = getNamedType(fieldDef.type);
        const enumValues = isEnumType(namedType)
          ? namedType.getValues().map(({ value }) => value) // TODO: Should we assert the value is a string?
          : null;
        // console.log({ enumValues });
        return {
          type: namedType.name,
          plural: isListType(getNullableType(fieldDef.type)),
          enumValues,
          nullable: isNullableType(fieldDef.type),
        };
      }
    }
    return {
      type: field.name.value === "id" ? "ID" : "String",
      plural: false,
      enumValues: null,
      nullable: false,
    };
  }

  // TODO: Mostly the same as _getScalarFieldTypeDetails, except for enum value retrieving and default value
  _getLinkedFieldTypeDetails(
    field: FieldNode,
    typeName: string | null | undefined
  ): {
    type: string;
    plural: boolean;
    enumValues: ReadonlyArray<string> | null;
    nullable: boolean;
  } | null {
    // TODO: Check if this can really be null in our case where we have the schema
    //       or if we can have an invariant assertion
    const parentType = typeName == null ? null : this._schema.getType(typeName);
    if (parentType) {
      invariant(
        isObjectType(parentType) || isInterfaceType(parentType),
        "Expected parent type to be one with selectable fields"
      );
      const fieldDef = parentType.getFields()[field.name.value];
      invariant(
        fieldDef,
        `Expected type "${typeName}" to have a field definition for "${field.name.value}"`
      );
      const namedType = getNamedType(fieldDef.type);
      return {
        type: namedType.name,
        plural: isListType(getNullableType(fieldDef.type)),
        enumValues: null,
        nullable: isNullableType(fieldDef.type),
      };
    }
    return null;
  }
}

type Variables = Record<string, any>;

// TODO: Do we need this?
type SelectionMetadata = {};

export interface MockData {
  __typename?: string | null;
  [fieldName: string]: unknown;
}

/**
 * Generate mock data for NormalizationOperation selection
 */
function generateData(
  node: OperationDefinitionNode,
  variables: Variables,
  mockResolvers: MockResolvers | null,
  selectionMetadata: SelectionMetadata | null,
  schema: GraphQLSchema,
  fragmentNodes: FragmentDefinitionNode[]
): MockData {
  const mockGenerator = new RelayMockPayloadGenerator({
    variables,
    mockResolvers,
    selectionMetadata,
    schema,
    fragmentNodes,
  });
  let operationType =
    node.operation.charAt(0).toUpperCase() + node.operation.slice(1);
  return mockGenerator.generate(node.selectionSet.selections, operationType);
}

// /**
//  * Type refinement for selection metadata
//  */
// function getSelectionMetadataFromOperation(
//   operation: OperationDescriptor,
// ): SelectionMetadata | null {
//   const selectionTypeInfo =
//     operation.request.node.params.metadata?.relayTestingSelectionTypeInfo;
//   if (
//     selectionTypeInfo != null &&
//     !Array.isArray(selectionTypeInfo) &&
//     typeof selectionTypeInfo === 'object'
//   ) {
//     const selectionMetadata: SelectionMetadata = {};
//     Object.keys(selectionTypeInfo).forEach(path => {
//       const item = selectionTypeInfo[path];
//       if (item != null && !Array.isArray(item) && typeof item === 'object') {
//         if (
//           typeof item.type === 'string' &&
//           typeof item.plural === 'boolean' &&
//           typeof item.nullable === 'boolean' &&
//           (item.enumValues === null || Array.isArray(item.enumValues))
//         ) {
//           selectionMetadata[path] = {
//             type: item.type,
//             plural: item.plural,
//             nullable: item.nullable,
//             enumValues: Array.isArray(item.enumValues)
//               ? item.enumValues.map(String)
//               : null,
//           };
//         }
//       }
//     });
//     return selectionMetadata;
//   }
//   return null;
// }

type GraphQLSingularResponse = { data: {} };

function generateDataForOperation(
  operation: OperationDescriptor,
  mockResolvers?: MockResolvers
): GraphQLSingularResponse {
  const operationNode = operation.request.node.definitions.find(
    (def) => def.kind === "OperationDefinition"
  ) as OperationDefinitionNode | undefined;
  const fragmentNodes = operation.request.node.definitions.filter(
    (def) => def.kind === "FragmentDefinition"
  ) as FragmentDefinitionNode[];
  invariant(operationNode, "Expected operation in document");
  const data = generateData(
    operationNode,
    operation.request.variables,
    mockResolvers ?? null,
    {}, // getSelectionMetadataFromOperation(operation),
    operation.schema,
    fragmentNodes
  );
  return { data };
}

export { generateDataForOperation as generate };
