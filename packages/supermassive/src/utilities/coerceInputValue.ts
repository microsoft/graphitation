import { GraphQLError } from "graphql";
import { didYouMean } from "../jsutils/didYouMean.js";
import { inspect } from "../jsutils/inspect.js";
import { invariant } from "../jsutils/invariant.js";
import { isIterableObject } from "../jsutils/isIterableObject.js";
import { isObjectLike } from "../jsutils/isObjectLike.js";
import type { Path } from "../jsutils/Path.js";
import { addPath, pathToArray } from "../jsutils/Path.js";
import { printPathArray } from "../jsutils/printPathArray.js";
import { suggestionList } from "../jsutils/suggestionList.js";
import { TypeReference } from "../types/definition";
import { SchemaFragment } from "../types/schema";
import { TypeNode } from "../supermassive-ast";

type OnErrorCB = (
  path: ReadonlyArray<string | number>,
  invalidValue: unknown,
  error: GraphQLError,
) => void;

/**
 * Coerces a JavaScript value given a GraphQL Input Type.
 */
export function coerceInputValue(
  inputValue: unknown,
  typeRef: TypeReference | TypeNode,
  schemaTypes: SchemaFragment,
  onError: OnErrorCB = defaultOnError,
): unknown {
  return coerceInputValueImpl(
    inputValue,
    typeRef,
    schemaTypes,
    onError,
    undefined,
  );
}

function defaultOnError(
  path: ReadonlyArray<string | number>,
  invalidValue: unknown,
  error: GraphQLError,
): void {
  let errorPrefix = "Invalid value " + inspect(invalidValue);
  if (path.length > 0) {
    errorPrefix += ` at "value${printPathArray(path)}"`;
  }
  error.message = errorPrefix + ": " + error.message;
  throw error;
}

function coerceInputValueImpl(
  inputValue: unknown,
  typeRef: TypeReference | TypeNode,
  schemaTypes: SchemaFragment,
  onError: OnErrorCB,
  path: Path | undefined,
): unknown {
  if (schemaTypes.isNonNullType(typeRef)) {
    if (inputValue != null) {
      return coerceInputValueImpl(
        inputValue,
        schemaTypes.unwrap(typeRef),
        schemaTypes,
        onError,
        path,
      );
    }
    onError(
      pathToArray(path),
      inputValue,
      new GraphQLError(
        `Expected non-nullable type "${schemaTypes.printTypeRef(
          typeRef,
        )}" not to be null.`,
      ),
    );
    return;
  }

  if (inputValue == null) {
    // Explicitly return the value null.
    return null;
  }

  if (schemaTypes.isListType(typeRef)) {
    const itemType = schemaTypes.unwrap(typeRef);
    if (isIterableObject(inputValue)) {
      return Array.from(inputValue, (itemValue, index) => {
        const itemPath = addPath(path, index, undefined);
        return coerceInputValueImpl(
          itemValue,
          itemType,
          schemaTypes,
          onError,
          itemPath,
        );
      });
    }
    // Lists accept a non-list value as a list of one.
    return [
      coerceInputValueImpl(inputValue, itemType, schemaTypes, onError, path),
    ];
  }

  const inputObjectType = schemaTypes.getInputObjectType(typeRef);
  if (inputObjectType) {
    const typeName = schemaTypes.printTypeRef(typeRef);
    if (!isObjectLike(inputValue)) {
      onError(
        pathToArray(path),
        inputValue,
        new GraphQLError(`Expected type "${typeRef}" to be an object.`),
      );
      return;
    }

    const coercedValue: Record<string, unknown> = {};
    const fieldDefs = schemaTypes.getInputObjectFields(inputObjectType);

    for (const [fieldName, field] of Object.entries(fieldDefs)) {
      const fieldValue = inputValue[fieldName];
      const defaultValue = schemaTypes.getDefaultValue(field);
      const fieldType = schemaTypes.getTypeRef(field);

      if (fieldValue === undefined) {
        if (defaultValue !== undefined) {
          coercedValue[fieldName] = defaultValue;
        } else if (schemaTypes.isNonNullType(fieldType)) {
          const typeStr = schemaTypes.printTypeRef(fieldType);
          onError(
            pathToArray(path),
            inputValue,
            new GraphQLError(
              `Field "${fieldName}" of required type "${typeStr}" was not provided.`,
            ),
          );
        }
        continue;
      }

      coercedValue[fieldName] = coerceInputValueImpl(
        fieldValue,
        fieldType,
        schemaTypes,
        onError,
        addPath(path, fieldName, typeName),
      );
    }

    // Ensure every provided field is defined.
    for (const fieldName of Object.keys(inputValue)) {
      if (fieldDefs[fieldName] == null) {
        const suggestions = suggestionList(fieldName, Object.keys(fieldDefs));
        onError(
          pathToArray(path),
          inputValue,
          new GraphQLError(
            `Field "${fieldName}" is not defined by type "${typeName}".` +
              didYouMean(suggestions),
          ),
        );
      }
    }
    return coercedValue;
  }

  const leafType = schemaTypes.getLeafTypeResolver(typeRef);
  if (leafType) {
    let parseResult;

    // Scalars and Enums determine if an input value is valid via parseValue(),
    // which can throw to indicate failure. If it throws, maintain a reference
    // to the original error.
    try {
      parseResult = leafType.parseValue(inputValue);
    } catch (error) {
      if (error instanceof GraphQLError) {
        onError(pathToArray(path), inputValue, error);
      } else {
        const typeName = schemaTypes.printTypeRef(typeRef);
        onError(
          pathToArray(path),
          inputValue,
          new GraphQLError(
            `Expected type "${typeName}". ` + (error as Error).message,
            {
              originalError: error as Error,
            },
          ),
        );
      }
      return;
    }
    if (parseResult === undefined) {
      const typeName = schemaTypes.printTypeRef(typeRef);
      onError(
        pathToArray(path),
        inputValue,
        new GraphQLError(`Expected type "${typeName}".`),
      );
    }
    return parseResult;
  }
  /* c8 ignore next 3 */
  // Not reachable, all possible types have been considered.
  invariant(
    false,
    "Unexpected input type: " + schemaTypes.printTypeRef(typeRef),
  );
}
