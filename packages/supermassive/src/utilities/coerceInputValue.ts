import { GraphQLError, locatedError } from "graphql";
import { didYouMean } from "../jsutils/didYouMean";
import { inspect } from "../jsutils/inspect";
import { invariant } from "../jsutils/invariant";
import { isIterableObject } from "../jsutils/isIterableObject";
import { isObjectLike } from "../jsutils/isObjectLike";
import type { Path } from "../jsutils/Path";
import { addPath, pathToArray } from "../jsutils/Path";
import { printPathArray } from "../jsutils/printPathArray";
import { suggestionList } from "../jsutils/suggestionList";
import {
  TypeReference,
  inspectTypeReference,
  isListType,
  isNonNullType,
  unwrap,
} from "../schema/reference";
import { SchemaFragment } from "../types";
import {
  getInputDefaultValue,
  getInputObjectFields,
  getInputObjectType,
  getInputValueTypeReference,
} from "../schema/definition";
import { getLeafTypeResolver } from "../schema/resolvers";

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
  typeRef: TypeReference,
  schemaFragment: SchemaFragment,
  onError: OnErrorCB = defaultOnError,
): unknown {
  return coerceInputValueImpl(
    inputValue,
    typeRef,
    schemaFragment,
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
  typeRef: TypeReference,
  schemaFragment: SchemaFragment,
  onError: OnErrorCB,
  path: Path | undefined,
): unknown {
  if (isNonNullType(typeRef)) {
    if (inputValue != null) {
      return coerceInputValueImpl(
        inputValue,
        unwrap(typeRef),
        schemaFragment,
        onError,
        path,
      );
    }
    onError(
      pathToArray(path),
      inputValue,
      locatedError(
        `Expected non-nullable type "${inspectTypeReference(
          typeRef,
        )}" not to be null.`,
        [],
      ),
    );
    return;
  }

  if (inputValue == null) {
    // Explicitly return the value null.
    return null;
  }

  if (isListType(typeRef)) {
    const itemType = unwrap(typeRef);
    if (isIterableObject(inputValue)) {
      return Array.from(inputValue, (itemValue, index) => {
        const itemPath = addPath(path, index, undefined);
        return coerceInputValueImpl(
          itemValue,
          itemType,
          schemaFragment,
          onError,
          itemPath,
        );
      });
    }
    // Lists accept a non-list value as a list of one.
    return [
      coerceInputValueImpl(inputValue, itemType, schemaFragment, onError, path),
    ];
  }

  const inputObjectType = getInputObjectType(
    schemaFragment.definitions,
    typeRef,
  );
  if (inputObjectType) {
    const typeName = inspectTypeReference(typeRef);
    if (!isObjectLike(inputValue)) {
      onError(
        pathToArray(path),
        inputValue,
        locatedError(`Expected type "${typeRef}" to be an object.`, []),
      );
      return;
    }

    const coercedValue: Record<string, unknown> = {};
    const fieldDefs = getInputObjectFields(inputObjectType);

    for (const [fieldName, field] of Object.entries(fieldDefs)) {
      const fieldValue = inputValue[fieldName];
      const defaultValue = getInputDefaultValue(field);
      const fieldTypeRef = getInputValueTypeReference(field);

      if (fieldValue === undefined) {
        if (defaultValue !== undefined) {
          coercedValue[fieldName] = defaultValue;
        } else if (isNonNullType(fieldTypeRef)) {
          const typeStr = inspectTypeReference(fieldTypeRef);
          onError(
            pathToArray(path),
            inputValue,
            locatedError(
              `Field "${fieldName}" of required type "${typeStr}" was not provided.`,
              [],
            ),
          );
        }
        continue;
      }

      coercedValue[fieldName] = coerceInputValueImpl(
        fieldValue,
        fieldTypeRef,
        schemaFragment,
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
          locatedError(
            `Field "${fieldName}" is not defined by type "${typeName}".` +
              didYouMean(suggestions),
            [],
          ),
        );
      }
    }
    return coercedValue;
  }

  const leafType = getLeafTypeResolver(schemaFragment, typeRef);
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
        const typeName = inspectTypeReference(typeRef);
        onError(
          pathToArray(path),
          inputValue,
          locatedError(
            `Expected type "${typeName}". ` + (error as Error).message,
            [],
            // TODO:
            // {
            //   originalError: error as Error,
            // },
          ),
        );
      }
      return;
    }
    if (parseResult === undefined) {
      onError(
        pathToArray(path),
        inputValue,
        locatedError(`Expected type "${inspectTypeReference(typeRef)}".`, []),
      );
    }
    return parseResult;
  }
  // Not reachable, all possible types have been considered.
  invariant(false, "Unexpected input type: " + inspectTypeReference(typeRef));
}
