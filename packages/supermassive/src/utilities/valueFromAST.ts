import { invariant } from "../jsutils/invariant";
import type { Maybe } from "../jsutils/Maybe";
import type { ObjMap } from "../jsutils/ObjMap";

import type { TypeReference } from "../schema/reference";
import { ValueNode, Kind } from "graphql";
import {
  inspectTypeReference,
  isListType,
  isNonNullType,
  unwrap,
} from "../schema/reference";
import * as Definitions from "../schema/definition";
import * as Resolvers from "../schema/resolvers";
import { SchemaFragment } from "../types";

/**
 * Produces a JavaScript value given a GraphQL Value AST.
 *
 * A GraphQL type must be provided, which will be used to interpret different
 * GraphQL Value literals.
 *
 * Returns `undefined` when the value could not be validly coerced according to
 * the provided type.
 *
 * | GraphQL Value        | JSON Value    |
 * | -------------------- | ------------- |
 * | Input Object         | Object        |
 * | List                 | Array         |
 * | Boolean              | Boolean       |
 * | String               | String        |
 * | Int / Float          | Number        |
 * | Enum Value           | Unknown       |
 * | NullValue            | null          |
 *
 */
export function valueFromAST(
  valueNode: Maybe<ValueNode>,
  typeRef: TypeReference,
  schemaFragment: SchemaFragment,
  variables?: Maybe<ObjMap<unknown>>,
): unknown {
  if (!valueNode) {
    // When there is no node, then there is also no value.
    // Importantly, this is different from returning the value null.
    return;
  }

  if (valueNode.kind === Kind.VARIABLE) {
    const variableName = valueNode.name.value;
    if (variables == null || variables[variableName] === undefined) {
      // No valid return value.
      return;
    }
    const variableValue = variables[variableName];
    if (variableValue === null && isNonNullType(typeRef)) {
      return; // Invalid: intentionally return no value.
    }
    // Note: This does no further checking that this variable is correct.
    // This assumes that this query has been validated and the variable
    // usage here is of the correct type.
    return variableValue;
  }

  if (isNonNullType(typeRef)) {
    if (valueNode.kind === Kind.NULL) {
      return; // Invalid: intentionally return no value.
    }
    return valueFromAST(valueNode, unwrap(typeRef), schemaFragment, variables);
  }

  if (valueNode.kind === Kind.NULL) {
    // This is explicitly returning the value null.
    return null;
  }

  if (isListType(typeRef)) {
    const itemTypeRef = unwrap(typeRef);
    if (valueNode.kind === Kind.LIST) {
      const coercedValues = [];
      for (const itemNode of valueNode.values) {
        if (isMissingVariable(itemNode, variables)) {
          // If an array contains a missing variable, it is either coerced to
          // null or if the item type is non-null, it considered invalid.
          if (isNonNullType(itemTypeRef)) {
            return; // Invalid: intentionally return no value.
          }
          coercedValues.push(null);
        } else {
          const itemValue = valueFromAST(
            itemNode,
            itemTypeRef,
            schemaFragment,
            variables,
          );
          if (itemValue === undefined) {
            return; // Invalid: intentionally return no value.
          }
          coercedValues.push(itemValue);
        }
      }
      return coercedValues;
    }
    const coercedValue = valueFromAST(
      valueNode,
      itemTypeRef,
      schemaFragment,
      variables,
    );
    if (coercedValue === undefined) {
      return; // Invalid: intentionally return no value.
    }
    return [coercedValue];
  }

  const defs = schemaFragment.definitions;

  const inputObjectType = Definitions.getInputObjectType(defs, typeRef);
  if (inputObjectType) {
    if (valueNode.kind !== Kind.OBJECT) {
      return; // Invalid: intentionally return no value.
    }
    const coercedObj = Object.create(null);
    const fieldNodes = new Map(
      valueNode.fields.map((field) => [field.name.value, field]),
    );

    const fieldDefs = Definitions.getInputObjectFields(inputObjectType);

    for (const [name, field] of Object.entries(fieldDefs)) {
      const fieldNode = fieldNodes.get(name);
      const fieldTypeRef = Definitions.getInputValueTypeReference(field);
      if (fieldNode == null || isMissingVariable(fieldNode.value, variables)) {
        const defaultValue = Definitions.getInputDefaultValue(field);
        if (defaultValue !== undefined) {
          coercedObj[name] = defaultValue;
        } else if (isNonNullType(fieldTypeRef)) {
          return; // Invalid: intentionally return no value.
        }
        continue;
      }
      const fieldValue = valueFromAST(
        fieldNode.value,
        fieldTypeRef,
        schemaFragment,
        variables,
      );
      if (fieldValue === undefined) {
        return; // Invalid: intentionally return no value.
      }
      coercedObj[name] = fieldValue;
    }
    return coercedObj;
  }

  const leafType = Resolvers.getLeafTypeResolver(schemaFragment, typeRef);
  if (leafType) {
    // Scalars and Enums fulfill parsing a literal value via parseLiteral().
    // Invalid values represent a failure to parse correctly, in which case
    // no value is returned.
    let result;
    try {
      result = leafType.parseLiteral(valueNode, variables);
    } catch (_error) {
      return; // Invalid: intentionally return no value.
    }
    if (result === undefined) {
      return; // Invalid: intentionally return no value.
    }
    return result;
  }
  /* c8 ignore next 3 */
  // Not reachable, all possible input types have been considered.
  invariant(false, "Unexpected input type: " + inspectTypeReference(typeRef));
}

// Returns true if the provided valueNode is a variable which is not defined
// in the set of variables.
function isMissingVariable(
  valueNode: ValueNode,
  variables: Maybe<ObjMap<unknown>>,
): boolean {
  return (
    valueNode.kind === Kind.VARIABLE &&
    (variables == null || variables[valueNode.name.value] === undefined)
  );
}
